import { afterAll, describe, expect, it } from 'vitest';
import { createFakeStripe } from '../../tools/devstack/src/fakeStripe';
import { signNowPayments, signStripePayload, verifyStripeSignature } from '../functions/_shared/stripe';
import {
  handleAction,
  handleNowPaymentsIpn,
  handleStripeWebhook,
  PaymentsError,
  ratesFromCbr,
  type NowPaymentsApi,
  type PaymentsDb,
  type PaymentsEnv,
} from '../functions/payments/handler';
import { closePool, createUser, useDb, walletFull } from './db';

const db = useDb();
afterAll(closePool);

const SECRET = 'whsec_test';
const IPN = 'ipn_test';
const URLS = { success_url: 'https://parri.test/balance?ok=1', cancel_url: 'https://parri.test/balance', return_url: 'https://parri.test/balance', refresh_url: 'https://parri.test/balance' };

/** PaymentsDb поверх транзакции теста (service_role ≈ владелец базы) */
const testDb: PaymentsDb = {
  async rpc(fn, args) {
    const keys = Object.keys(args);
    const r = await db.sys<{ r: any }>(
      `select to_jsonb(public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})) as r`,
      keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k])),
    );
    return r.rows[0]?.r;
  },
  async one(table, match) {
    const keys = Object.keys(match);
    const r = await db.sys<{ r: any }>(
      `select to_jsonb(t) as r from public.${table} t where ${keys.map((k, i) => `${k} = $${i + 1}`).join(' and ')} limit 1`,
      keys.map((k) => match[k]),
    );
    return r.rows[0]?.r ?? null;
  },
};

function setup() {
  const delivered: string[] = [];
  const env: PaymentsEnv = { stripe: null, stripeWebhookSecret: SECRET, nowpayments: null, nowpaymentsIpnSecret: IPN };
  const fake = createFakeStripe({
    webhookSecret: SECRET,
    pagesBase: 'http://dev',
    deliver: async (raw, sig) => {
      delivered.push(raw);
      await handleStripeWebhook(env, testDb, raw, sig);
    },
  });
  env.stripe = fake.api;
  const np: NowPaymentsApi = { createPayment: async (p) => ({ payment_id: 'np_' + p.order_id.slice(0, 8), pay_address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', pay_amount: p.price_amount }) };
  env.nowpayments = np;
  return { env, fake, delivered };
}

describe('Пополнение картой через Checkout', () => {
  it('деньги приходят только после события от Stripe; повтор события не удваивает', async () => {
    const { env, fake, delivered } = setup();
    const u = await createUser(db);
    const r = (await handleAction(env, testDb, { id: u.id, email: u.email }, { action: 'topup', amount_cents: 2500, ...URLS })) as { url: string; payment_id: string };
    expect(r.url).toMatch(/\/dev\/stripe\/checkout\/cs_test_/);
    expect((await walletFull(db, u.id)).available).toBe(0);
    const session = [...fake.state.sessions.values()][0]!;
    expect(session.line_items[0].price_data.unit_amount).toBe(2500);
    await fake.completeCheckout(session.id);
    expect((await walletFull(db, u.id)).available).toBe(2500);
    // Повторная доставка того же события
    await handleStripeWebhook(env, testDb, delivered[0]!, await signStripePayload(delivered[0]!, SECRET));
    expect((await walletFull(db, u.id)).available).toBe(2500);
  });

  it('отклонённый платёж не зачисляется; поддельная подпись отвергается', async () => {
    const { env, fake } = setup();
    const u = await createUser(db);
    await handleAction(env, testDb, { id: u.id }, { action: 'topup', amount_cents: 1000, ...URLS });
    const session = [...fake.state.sessions.values()][0]!;
    await fake.completeCheckout(session.id, false);
    expect((await walletFull(db, u.id)).available).toBe(0);
    const p = await testDb.one<{ status: string }>('payments', { provider_ref: session.id });
    expect(p!.status).toBe('canceled');

    const forged = JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed', data: { object: { ...session, mode: 'payment', payment_status: 'paid' } } });
    await expect(handleStripeWebhook(env, testDb, forged, await signStripePayload(forged, 'whsec_wrong'))).rejects.toThrow('bad_signature');
  });

  it('минимум $5; без ключа Stripe — «оплата недоступна»', async () => {
    const { env } = setup();
    const u = await createUser(db);
    await expect(handleAction(env, testDb, { id: u.id }, { action: 'topup', amount_cents: 499, ...URLS })).rejects.toThrow('topup_below_min');
    await expect(handleAction({ ...env, stripe: null }, testDb, { id: u.id }, { action: 'topup', amount_cents: 1000, ...URLS })).rejects.toBeInstanceOf(PaymentsError);
  });

  it('проверка статуса сверяется со Stripe, если вебхук задержался', async () => {
    const { env, fake } = setup();
    const u = await createUser(db);
    const r = (await handleAction(env, testDb, { id: u.id }, { action: 'topup', amount_cents: 700, ...URLS })) as { payment_id: string };
    const s = [...fake.state.sessions.values()][0]!;
    s.status = 'complete';
    s.payment_status = 'paid';
    s.payment_intent = 'pi_late';
    const p = (await handleAction(env, testDb, { id: u.id }, { action: 'payment_status', payment_id: r.payment_id })) as { status: string };
    expect(p.status).toBe('succeeded');
    expect((await walletFull(db, u.id)).available).toBe(700);
  });
});

describe('Подписка Pro', () => {
  it('Checkout → Pro и запись в истории платежей; отмена в портале → Free', async () => {
    const { env, fake } = setup();
    const u = await createUser(db);
    const r = (await handleAction(env, testDb, { id: u.id }, { action: 'subscribe', interval: 'year', ...URLS })) as { url: string };
    expect(r.url).toContain('/dev/stripe/checkout/');
    const session = [...fake.state.sessions.values()][0]!;
    expect(session.line_items[0].price_data).toMatchObject({ unit_amount: 14400, recurring: { interval: 'year' } });
    await fake.completeCheckout(session.id);
    expect((await db.sys(`select plan from public.profiles where id = $1`, [u.id])).rows[0].plan).toBe('pro');
    const pays = await db.sys(`select kind, amount_cents::int, status from public.payments where user_id = $1`, [u.id]);
    expect(pays.rows).toEqual([{ kind: 'subscription', amount_cents: 14400, status: 'succeeded' }]);
    // Баланс подписка не пополняет
    expect((await walletFull(db, u.id)).available).toBe(0);
    await expect(handleAction(env, testDb, { id: u.id }, { action: 'subscribe', interval: 'month', ...URLS })).rejects.toThrow('already_subscribed');

    const portal = (await handleAction(env, testDb, { id: u.id }, { action: 'portal', return_url: URLS.return_url })) as { url: string };
    expect(portal.url).toContain('/dev/stripe/portal/');
    await fake.cancelSubscription([...fake.state.subscriptions.keys()][0]!);
    expect((await db.sys(`select plan from public.profiles where id = $1`, [u.id])).rows[0].plan).toBe('free');
  });
});

describe('Выплаты через Stripe Connect', () => {
  it('настройка → заявка → одобрение → перевод на счёт исполнителя', async () => {
    const { env, fake } = setup();
    const u = await createUser(db, { balance: 20_000 });
    const admin = await createUser(db, { role: 'admin' });
    const link = (await handleAction(env, testDb, { id: u.id }, { action: 'connect', ...URLS })) as { url: string };
    expect(link.url).toContain('/dev/stripe/connect/acct_');
    await db.fails(db.as(u.id, `select public.request_payout('stripe', 5000, null, null, true)`), 'payouts_not_setup');
    await fake.completeConnect([...fake.state.accounts.keys()][0]!);
    const payout = (await db.as<{ id: string }>(u.id, `select (public.request_payout('stripe', 5000, null, null, true)).id`)).rows[0]!.id;
    await expect(handleAction(env, testDb, { id: u.id }, { action: 'payout_execute', payout_id: payout })).rejects.toThrow('forbidden');
    await expect(handleAction(env, testDb, { id: admin.id }, { action: 'payout_execute', payout_id: payout })).rejects.toThrow('invalid_status');
    await db.as(admin.id, `select public.admin_payout_decide($1, 'approve')`, [payout]);
    const done = (await handleAction(env, testDb, { id: admin.id }, { action: 'payout_execute', payout_id: payout })) as { status: string };
    expect(done.status).toBe('paid');
    expect(fake.state.transfers).toHaveLength(1);
    expect(fake.state.transfers[0]).toMatchObject({ amount: 5000, currency: 'usd' });
    expect(await walletFull(db, u.id)).toMatchObject({ available: 15_000, held: 0 });
  });
});

describe('Возврат картой', () => {
  it('модератор проводит возврат через Stripe — баланс уменьшается один раз', async () => {
    const { env, fake } = setup();
    const u = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    await handleAction(env, testDb, { id: u.id }, { action: 'topup', amount_cents: 3000, ...URLS });
    await fake.completeCheckout([...fake.state.sessions.keys()][0]!);
    const payment = (await db.sys<{ id: string }>(`select id from public.payments where user_id = $1`, [u.id])).rows[0]!.id;
    const refund = (await db.as<{ id: string }>(u.id, `select (public.request_refund($1, null, 'not_provided', 1000, 'Передумал, верните часть пополнения')).id`, [payment])).rows[0]!.id;
    const r = (await handleAction(env, testDb, { id: admin.id }, { action: 'refund_execute', refund_id: refund })) as { status: string };
    expect(r.status).toBe('refunded');
    expect(fake.state.refunds[0]).toMatchObject({ amount: 1000 });
    expect((await walletFull(db, u.id)).available).toBe(2000);
  });
});

describe('USDT через NOWPayments', () => {
  it('адрес для перевода; IPN «finished» зачисляет USDT; подпись проверяется', async () => {
    const { env } = setup();
    const u = await createUser(db);
    const r = (await handleAction(env, testDb, { id: u.id }, { action: 'topup', method: 'usdt', network: 'TRC20', amount_cents: 2500 })) as { pay_address: string; payment_id: string };
    expect(r.pay_address).toMatch(/^T/);
    await expect(handleAction(env, testDb, { id: u.id }, { action: 'topup', method: 'usdt', network: 'TRC20', amount_cents: 1999 })).rejects.toThrow('topup_below_min');
    const ref = (await testDb.one<{ provider_ref: string }>('payments', { id: r.payment_id }))!.provider_ref;
    const body = { payment_id: ref, payment_status: 'finished' };
    await expect(handleNowPaymentsIpn(env, testDb, body, 'deadbeef')).rejects.toThrow('bad_signature');
    await handleNowPaymentsIpn(env, testDb, body, await signNowPayments(body, IPN));
    await handleNowPaymentsIpn(env, testDb, body, await signNowPayments(body, IPN));
    expect(await walletFull(db, u.id)).toMatchObject({ available: 0, usdt_available: 2500 });
  });
});

describe('Подписи и курсы', () => {
  it('подпись Stripe: просроченная и изменённая отвергаются', async () => {
    const payload = '{"id":"evt_1"}';
    const sig = await signStripePayload(payload, SECRET, 1_000_000);
    expect(await verifyStripeSignature(payload, sig, SECRET, 300, 1_000_100)).toBe(true);
    expect(await verifyStripeSignature(payload, sig, SECRET, 300, 1_000_400)).toBe(false);
    expect(await verifyStripeSignature(payload + ' ', sig, SECRET, 300, 1_000_100)).toBe(false);
    expect(await verifyStripeSignature(payload, null, SECRET)).toBe(false);
  });

  it('курсы ЦБ: рублей за доллар и кросс-курсы', () => {
    const rates = ratesFromCbr({ Valute: { USD: { Nominal: 1, Value: 81.5 }, EUR: { Nominal: 1, Value: 95 }, KZT: { Nominal: 100, Value: 15.2 } } });
    expect(rates.RUB).toBe(81.5);
    expect(rates.EUR).toBeCloseTo(0.857895, 5);
    expect(rates.KZT).toBeCloseTo(536.184211, 4);
  });
});
