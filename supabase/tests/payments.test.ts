import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLedgerInvariants, closePool, createUser, creditVia, publish, respond, useDb, walletFull } from './db';

const db = useDb();
afterAll(closePool);

const adult = async (opts: Parameters<typeof createUser>[1] = {}) => createUser(db, opts); // 2004 г. р.
const connect = (uid: string) => db.sys(`select public.svc_connect_update($1, $2, true, true)`, [uid, `acct_${uid.slice(0, 8)}`]);
const payout = (uid: string, method: string, amount: number, network: string | null = null, address: string | null = null, confirmed = true) =>
  db.as<{ id: string; status: string }>(
    uid,
    `select (p).id, (p).status from (select public.request_payout($1::public.payout_method, $2, $3::public.crypto_network, $4, $5) p) x`,
    [method, amount, network, address, confirmed],
  );

describe('Пополнение: баланс меняется только после вебхука', () => {
  it('платёж создаётся «в ожидании», зачисляется один раз, повтор вебхука ничего не меняет', async () => {
    const u = await adult();
    const ref = `cs_${randomUUID()}`;
    await db.sys(`select public.svc_payment_create($1, 'topup', 'stripe', 'USD', 2500, $2)`, [u.id, ref]);
    expect((await walletFull(db, u.id)).available).toBe(0);
    await db.sys(`select public.svc_payment_succeeded($1, 'pi_1')`, [ref]);
    await db.sys(`select public.svc_payment_succeeded($1, 'pi_1')`, [ref]);
    expect((await walletFull(db, u.id)).available).toBe(2500);
    const p = await db.as(u.id, `select status, credited_tx is not null as credited from public.payments`);
    expect(p.rows).toEqual([{ status: 'succeeded', credited: true }]);
    await assertLedgerInvariants(db);
  });

  it('неудачный платёж не зачисляется; минимумы $5 картой и 20 USDT', async () => {
    const u = await adult();
    const ref = `cs_${randomUUID()}`;
    await db.sys(`select public.svc_payment_create($1, 'topup', 'stripe', 'USD', 500, $2)`, [u.id, ref]);
    await db.sys(`select public.svc_payment_failed($1, 'card_declined')`, [ref]);
    await db.sys(`select public.svc_payment_succeeded($1)`, [ref]);
    expect((await walletFull(db, u.id)).available).toBe(0);
    await db.fails(db.sys(`select public.svc_payment_create($1, 'topup', 'stripe', 'USD', 499, 'x1')`, [u.id]), 'topup_below_min');
    await db.fails(db.sys(`select public.svc_payment_create($1, 'topup', 'nowpayments', 'USDT', 1999, 'x2')`, [u.id]), 'topup_below_min');
  });

  it('событие провайдера обрабатывается один раз', async () => {
    const id = `evt_${randomUUID()}`;
    const first = await db.sys<{ ok: boolean }>(`select public.svc_event_begin($1, 'stripe', 'checkout.session.completed', '{}') as ok`, [id]);
    expect(first.rows[0]!.ok).toBe(true);
    await db.sys(`select public.svc_event_done($1)`, [id]);
    const again = await db.sys<{ ok: boolean }>(`select public.svc_event_begin($1, 'stripe', 'checkout.session.completed', '{}') as ok`, [id]);
    expect(again.rows[0]!.ok).toBe(false);
  });

  it('клиент не может вызвать сервисные функции', async () => {
    const u = await adult();
    await db.fails(db.as(u.id, `select public.svc_payment_create($1, 'topup', 'stripe', 'USD', 1000, 'hack')`, [u.id]), 'permission denied');
    await db.fails(db.as(u.id, `select public.svc_payment_succeeded('hack')`), 'permission denied');
    await db.fails(db.as(u.id, `select public.svc_subscription_update($1, 'month', 'active', 'sub', now(), false)`, [u.id]), 'permission denied');
  });
});

describe('Вывод: удержание, лимиты, выплата', () => {
  it('заявка удерживает деньги; выплата списывает удержание; отказ возвращает', async () => {
    const u = await adult();
    await creditVia(db, u.id, 50_000);
    await connect(u.id);
    const p = (await payout(u.id, 'stripe', 20_000)).rows[0]!;
    expect(p.status).toBe('requested');
    expect(await walletFull(db, u.id)).toMatchObject({ available: 30_000, held: 20_000 });
    await db.sys(`update public.payouts set status = 'approved' where id = $1`, [p.id]);
    await db.sys(`select public.svc_payout_processing($1, 'po_1')`, [p.id]);
    await db.sys(`select public.svc_payout_paid($1)`, [p.id]);
    await db.sys(`select public.svc_payout_paid($1)`, [p.id]);
    expect(await walletFull(db, u.id)).toMatchObject({ available: 30_000, held: 0 });
    await assertLedgerInvariants(db);
  });

  it('модератор отклоняет — деньги возвращаются на баланс', async () => {
    const u = await adult();
    const admin = await createUser(db, { role: 'admin' });
    await creditVia(db, u.id, 5000);
    await connect(u.id);
    const p = (await payout(u.id, 'stripe', 5000)).rows[0]!;
    await db.fails(db.as(u.id, `select public.admin_payout_decide($1, 'approve')`, [p.id]), 'forbidden');
    await db.fails(db.as(admin.id, `select public.admin_payout_decide($1, 'reject', '')`, [p.id]), 'reason_required');
    await db.as(admin.id, `select public.admin_payout_decide($1, 'reject', 'Реквизиты не совпадают с именем')`, [p.id]);
    expect(await walletFull(db, u.id)).toMatchObject({ available: 5000, held: 0 });
    const r = await db.as(u.id, `select status, failure_reason from public.payouts`);
    expect(r.rows[0]).toEqual({ status: 'rejected', failure_reason: 'Реквизиты не совпадают с именем' });
    await assertLedgerInvariants(db);
  });

  it('сбой выплаты у провайдера возвращает деньги', async () => {
    const u = await adult();
    await creditVia(db, u.id, 5000);
    await connect(u.id);
    const p = (await payout(u.id, 'stripe', 1000)).rows[0]!;
    await db.sys(`update public.payouts set status = 'processing' where id = $1`, [p.id]);
    await db.sys(`select public.svc_payout_failed($1, 'account_closed')`, [p.id]);
    expect(await walletFull(db, u.id)).toMatchObject({ available: 5000, held: 0 });
    await assertLedgerInvariants(db);
  });

  it('только 18+, минимум $10 / 20 USDT, подтверждение, настроенные выплаты, адрес кошелька', async () => {
    const u = await adult();
    await creditVia(db, u.id, 50_000);
    await db.fails(payout(u.id, 'stripe', 1000), 'payouts_not_setup');
    await connect(u.id);
    await db.fails(payout(u.id, 'stripe', 999), 'payout_below_min');
    await db.fails(payout(u.id, 'stripe', 1000, null, null, false), 'confirm_required');
    await creditVia(db, u.id, 5000, 'USDT');
    await db.fails(payout(u.id, 'usdt', 1999, 'TRC20', 'TXYZabcdefghijklmnopqrstuvwxyz12'), 'payout_below_min');
    await db.fails(payout(u.id, 'usdt', 2000, 'TRC20', 'bad address!'), 'invalid_address');

    const teen = await createUser(db);
    await db.sys(`update public.profile_private set birth_date = (current_date - interval '17 years')::date where id = $1`, [teen.id]);
    await creditVia(db, teen.id, 5000);
    await connect(teen.id);
    await db.fails(payout(teen.id, 'stripe', 1000), 'payout_age_18');
  });

  it('не чаще раза в час и не больше $1000 в сутки', async () => {
    const u = await adult();
    await creditVia(db, u.id, 200_000);
    await connect(u.id);
    await payout(u.id, 'stripe', 1000);
    await db.fails(payout(u.id, 'stripe', 1000), 'payout_rate_limited');
    await db.sys(`update public.payouts set created_at = now() - interval '2 hours' where user_id = $1`, [u.id]);
    await db.fails(payout(u.id, 'stripe', 99_500), 'payout_daily_limit');
    await payout(u.id, 'stripe', 99_000);
    expect(await walletFull(db, u.id)).toMatchObject({ available: 100_000, held: 100_000 });
  });

  it('USDT выводится со своего счёта', async () => {
    const u = await adult();
    await creditVia(db, u.id, 5000, 'USDT');
    await payout(u.id, 'usdt', 3000, 'TRC20', 'TXYZabcdefghijklmnopqrstuvwxyz12');
    expect(await walletFull(db, u.id)).toMatchObject({ available: 0, usdt_available: 2000, usdt_held: 3000 });
    await assertLedgerInvariants(db);
  });
});

describe('Задача в USDT', () => {
  it('Сейф и выплата идут в USDT, долларовый баланс не трогается', async () => {
    const c = await adult();
    const e = await adult();
    await creditVia(db, c.id, 10_000, 'USDT');
    const task = await publish(db, c.id, { reward: 2500, currency: 'USDT', checklist: [] });
    expect(await walletFull(db, c.id)).toMatchObject({ available: 0, usdt_available: 10_000 - 2625, usdt_safe: 2625 });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/r')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.as(c.id, `select public.review_submission($1, 'accept', '{}')`, [sub]);
    expect(await walletFull(db, e.id)).toMatchObject({ available: 0, usdt_available: 2500 });
    expect(await walletFull(db, c.id)).toMatchObject({ usdt_safe: 0 });
    await assertLedgerInvariants(db);
  });
});

describe('Публикация: идемпотентность и курс рубля', () => {
  it('повторный вызов с тем же id не списывает деньги второй раз', async () => {
    const c = await adult({ balance: 10_000 });
    const id = randomUUID();
    await publish(db, c.id, { id, reward: 2500 });
    await publish(db, c.id, { id, reward: 2500 });
    expect(await walletFull(db, c.id)).toMatchObject({ available: 10_000 - 2625, safe: 2625 });
    const other = await adult({ balance: 10_000 });
    await db.fails(publish(db, other.id, { id }), 'forbidden');
  });

  it('цена в рублях: если курс обновился — просим подтвердить сумму', async () => {
    const c = await adult({ balance: 10_000 });
    const rate = (await db.sys<{ per_usd: string; fetched_at: Date }>(`select per_usd, fetched_at from public.fx_rates where currency = 'RUB'`)).rows[0]!;
    const rub = 2500 * Number(rate.per_usd); // копейки
    const call = (fetchedAt: Date, reward: number) =>
      db.as(
        c.id,
        `select public.publish_task(p_id => gen_random_uuid(), p_title => 'Рублёвая задача', p_brief => 'Коротко',
           p_category => 'design', p_result_format => 'pdf', p_deadline => '24h', p_kind => 'online',
           p_reward_cents => $1, p_input_currency => 'RUB', p_input_amount => $2, p_rate_fetched_at => $3)`,
        [reward, Math.round(rub), fetchedAt],
      );
    await db.fails(call(new Date(rate.fetched_at.getTime() - 86_400_000), 2500), 'rate_changed');
    await db.fails(call(rate.fetched_at, 2600), 'rate_changed');
    await call(rate.fetched_at, 2500);
    const t = await db.as(c.id, `select input_currency, input_amount::int from public.tasks where customer_id = $1`, [c.id]);
    expect(t.rows[0]).toEqual({ input_currency: 'RUB', input_amount: Math.round(rub) });
  });
});

describe('Подписка Pro', () => {
  it('активная подписка включает Pro, отмена после окончания периода — Free', async () => {
    const u = await adult();
    await db.sys(`select public.svc_subscription_update($1, 'month', 'active', 'sub_1', now() + interval '30 days', false)`, [u.id]);
    expect((await db.sys(`select plan from public.profiles where id = $1`, [u.id])).rows[0].plan).toBe('pro');
    await db.sys(`select public.svc_subscription_update($1, 'month', 'active', 'sub_1', now() + interval '30 days', true)`, [u.id]);
    expect((await db.sys(`select plan from public.profiles where id = $1`, [u.id])).rows[0].plan).toBe('pro');
    await db.sys(`select public.svc_subscription_update($1, 'month', 'canceled', 'sub_1', now(), false)`, [u.id]);
    expect((await db.sys(`select plan from public.profiles where id = $1`, [u.id])).rows[0].plan).toBe('free');
    const s = await db.as(u.id, `select status, billing_interval from public.subscriptions`);
    expect(s.rows).toEqual([{ status: 'canceled', billing_interval: 'month' }]);
  });
});

describe('Возвраты', () => {
  it('запрос → модератор → провайдер вернул: деньги списаны с баланса один раз', async () => {
    const u = await adult();
    const admin = await createUser(db, { role: 'admin' });
    const ref = await creditVia(db, u.id, 3000);
    const payment = (await db.sys<{ id: string }>(`select id from public.payments where provider_ref = $1`, [ref])).rows[0]!.id;
    await db.fails(
      db.as(u.id, `select public.request_refund($1, null, 'double_charge', 3001, 'Списали два раза за одно пополнение')`, [payment]),
      'refund_too_big',
    );
    const r = await db.as<{ id: string }>(u.id, `select (public.request_refund($1, null, 'double_charge', 3000, 'Списали два раза за одно пополнение')).id`, [payment]);
    const id = r.rows[0]!.id;
    await db.fails(
      db.as(u.id, `select public.request_refund($1, null, 'double_charge', 100, 'Повторный запрос на то же самое')`, [payment]),
      'refund_already_requested',
    );
    await db.as(admin.id, `select public.admin_refund_decide($1, 'review')`, [id]);
    await db.sys(`select public.svc_refund_done($1, 3000)`, [id]);
    await db.sys(`select public.svc_refund_done($1, 3000)`, [id]);
    expect((await walletFull(db, u.id)).available).toBe(0);
    const p = await db.as(u.id, `select status, refunded_cents::int from public.payments`);
    expect(p.rows).toEqual([{ status: 'refunded', refunded_cents: 3000 }]);
    await assertLedgerInvariants(db);
  });

  it('квитанция доступна только участнику операции', async () => {
    const u = await adult({ balance: 10_000 });
    const other = await adult();
    const task = await publish(db, u.id);
    const tx = (await db.sys<{ tx_id: string }>(`select tx_id from public.ledger_entries where task_id = $1 limit 1`, [task])).rows[0]!.tx_id;
    const r = await db.as<{ r: { kind: string; task: { fee_bps: number } } }>(u.id, `select public.receipt($1) as r`, [tx]);
    expect(r.rows[0]!.r.kind).toBe('task_lock');
    expect(r.rows[0]!.r.task.fee_bps).toBe(500);
    await db.fails(db.as(other.id, `select public.receipt($1)`, [tx]), 'forbidden');
  });
});
