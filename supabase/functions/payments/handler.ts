/**
 * Деньги через провайдеров. Общая логика для Edge Functions (Deno) и devstack (Node):
 *  - действия пользователя (пополнение, подключение выплат, подписка, портал, статус платежа);
 *  - действия модератора (провести одобренную выплату, провести возврат);
 *  - вебхуки Stripe и NOWPayments (баланс меняется только здесь, после проверки подписи).
 * Деньги считаются в базе (svc_* функции), здесь — только вызовы провайдеров и проверки.
 */
import { StripeError, verifyNowPayments, verifyStripeSignature, type StripeApi } from '../_shared/stripe.ts';

export interface PaymentsDb {
  /** RPC под service_role */
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  /** Одна строка по равенству полей (service_role, без RLS) */
  one<T = Record<string, any>>(table: string, match: Record<string, unknown>): Promise<T | null>;
}

export interface NowPaymentsApi {
  createPayment(p: { price_amount: number; price_currency: 'usd'; pay_currency: string; order_id: string; ipn_callback_url?: string }): Promise<{
    payment_id: string | number;
    pay_address: string;
    pay_amount: number;
  }>;
}

export interface PaymentsEnv {
  stripe: StripeApi | null;
  stripeWebhookSecret: string | null;
  nowpayments: NowPaymentsApi | null;
  nowpaymentsIpnSecret: string | null;
  /** Публичный адрес функций для IPN NOWPayments */
  functionsUrl?: string;
}

export interface Caller {
  id: string;
  email?: string | null;
}

export class PaymentsError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

const MIN_TOPUP_CARD = 500;
const MIN_TOPUP_USDT = 2000;
const MAX_TOPUP = 1_000_000;
export const PRO_PRICES = { month: 1500, year: 14400 } as const;
const NETWORK_CURRENCY: Record<string, string> = { TRC20: 'usdttrc20', ERC20: 'usdterc20', BEP20: 'usdtbsc' };

const isUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\/\S+$/.test(s) && s.length < 2000;
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);

function needStripe(env: PaymentsEnv): StripeApi {
  if (!env.stripe) throw new PaymentsError(503, 'payments_unavailable');
  return env.stripe;
}

async function ensureCustomer(db: PaymentsDb, stripe: StripeApi, user: Caller): Promise<string> {
  const row = await db.one<{ customer_id: string }>('stripe_customers', { user_id: user.id });
  if (row) return row.customer_id;
  const c = await stripe.post<{ id: string }>(
    '/v1/customers',
    { email: user.email ?? undefined, metadata: { user_id: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  await db.rpc('svc_customer_upsert', { p_user: user.id, p_customer: c.id });
  return c.id;
}

async function isStaff(db: PaymentsDb, userId: string): Promise<boolean> {
  const p = await db.one<{ role: string; banned_at: string | null }>('profiles', { id: userId });
  return !!p && !p.banned_at && (p.role === 'admin' || p.role === 'moderator');
}

/** Действия пользователя и модератора: body = { action, ... } */
export async function handleAction(env: PaymentsEnv, db: PaymentsDb, user: Caller, body: Record<string, any>): Promise<unknown> {
  switch (body.action) {
    // ---------- Пополнение ----------
    case 'topup': {
      const amount = int(body.amount_cents);
      if (body.method === 'usdt') {
        if (!env.nowpayments) throw new PaymentsError(503, 'crypto_unavailable');
        if (!(amount >= MIN_TOPUP_USDT && amount <= MAX_TOPUP)) throw new PaymentsError(400, 'topup_below_min');
        const network = String(body.network ?? 'TRC20');
        if (!NETWORK_CURRENCY[network]) throw new PaymentsError(400, 'invalid_network');
        const orderId = crypto.randomUUID();
        const p = await env.nowpayments.createPayment({
          price_amount: amount / 100,
          price_currency: 'usd',
          pay_currency: NETWORK_CURRENCY[network]!,
          order_id: orderId,
          ipn_callback_url: env.functionsUrl ? `${env.functionsUrl}/crypto-webhook` : undefined,
        });
        const row = await db.rpc<{ id: string }>('svc_payment_create', {
          p_user: user.id,
          p_kind: 'topup',
          p_provider: 'nowpayments',
          p_currency: 'USDT',
          p_amount_cents: amount,
          p_provider_ref: String(p.payment_id),
          p_meta: { order_id: orderId },
          p_network: network,
          p_pay_address: p.pay_address,
          p_pay_amount: String(p.pay_amount),
        });
        return { payment_id: row.id, pay_address: p.pay_address, pay_amount: p.pay_amount, network };
      }
      const stripe = needStripe(env);
      if (!(amount >= MIN_TOPUP_CARD && amount <= MAX_TOPUP)) throw new PaymentsError(400, 'topup_below_min');
      if (!isUrl(body.success_url) || !isUrl(body.cancel_url)) throw new PaymentsError(400, 'invalid_return_url');
      const customer = await ensureCustomer(db, stripe, user);
      const session = await stripe.post<{ id: string; url: string }>('/v1/checkout/sessions', {
        mode: 'payment',
        customer,
        client_reference_id: user.id,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount, product_data: { name: 'Пополнение баланса Parri' } } }],
        metadata: { user_id: user.id, kind: 'topup' },
        payment_intent_data: { metadata: { user_id: user.id, kind: 'topup' } },
        success_url: `${body.success_url}${body.success_url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: body.cancel_url,
      });
      const row = await db.rpc<{ id: string }>('svc_payment_create', {
        p_user: user.id,
        p_kind: 'topup',
        p_provider: 'stripe',
        p_currency: 'USD',
        p_amount_cents: amount,
        p_provider_ref: session.id,
        p_meta: {},
      });
      return { payment_id: row.id, url: session.url };
    }

    // ---------- Статус платежа: сверка напрямую со Stripe (если вебхук задержался) ----------
    case 'payment_status': {
      const payment = await db.one<Record<string, any>>('payments', { id: String(body.payment_id ?? '') });
      if (!payment || payment.user_id !== user.id) throw new PaymentsError(404, 'payment_not_found');
      if (payment.status === 'pending' && payment.provider === 'stripe' && env.stripe) {
        const s = await env.stripe.get<{ payment_status: string; status: string; payment_intent: string | null }>(
          `/v1/checkout/sessions/${payment.provider_ref}`,
        );
        if (s.payment_status === 'paid') {
          return db.rpc('svc_payment_succeeded', { p_provider_ref: payment.provider_ref, p_provider_payment: s.payment_intent });
        }
        if (s.status === 'expired') {
          return db.rpc('svc_payment_failed', { p_provider_ref: payment.provider_ref, p_reason: 'expired', p_canceled: true });
        }
      }
      return payment;
    }

    // ---------- Stripe Connect: проверка личности и реквизитов у Stripe ----------
    case 'connect': {
      const stripe = needStripe(env);
      if (!isUrl(body.return_url) || !isUrl(body.refresh_url)) throw new PaymentsError(400, 'invalid_return_url');
      let acct = (await db.one<{ account_id: string }>('connect_accounts', { user_id: user.id }))?.account_id;
      if (!acct) {
        const a = await stripe.post<{ id: string }>(
          '/v1/accounts',
          { type: 'express', email: user.email ?? undefined, capabilities: { transfers: { requested: true } }, metadata: { user_id: user.id } },
          { idempotencyKey: `connect-${user.id}` },
        );
        acct = a.id;
        await db.rpc('svc_connect_update', { p_user: user.id, p_account: acct, p_details: false, p_payouts: false });
      }
      const link = await stripe.post<{ url: string }>('/v1/account_links', {
        account: acct,
        refresh_url: body.refresh_url,
        return_url: body.return_url,
        type: 'account_onboarding',
      });
      return { url: link.url };
    }

    case 'connect_status': {
      const row = await db.one<{ account_id: string }>('connect_accounts', { user_id: user.id });
      if (!row) return { connected: false, payouts_enabled: false, details_submitted: false };
      const stripe = needStripe(env);
      const a = await stripe.get<{ details_submitted: boolean; payouts_enabled: boolean }>(`/v1/accounts/${row.account_id}`);
      await db.rpc('svc_connect_update', { p_user: user.id, p_account: row.account_id, p_details: a.details_submitted, p_payouts: a.payouts_enabled });
      return { connected: true, payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted };
    }

    // ---------- Подписка Pro ----------
    case 'subscribe': {
      const stripe = needStripe(env);
      const interval = body.interval === 'year' ? 'year' : 'month';
      if (!isUrl(body.success_url) || !isUrl(body.cancel_url)) throw new PaymentsError(400, 'invalid_return_url');
      const sub = await db.one<{ status: string }>('subscriptions', { user_id: user.id });
      if (sub && ['active', 'trialing', 'past_due'].includes(sub.status)) throw new PaymentsError(409, 'already_subscribed');
      const customer = await ensureCustomer(db, stripe, user);
      const session = await stripe.post<{ url: string }>('/v1/checkout/sessions', {
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: 'usd', unit_amount: PRO_PRICES[interval], recurring: { interval }, product_data: { name: 'Parri Pro' } },
          },
        ],
        metadata: { user_id: user.id, kind: 'subscription', interval },
        subscription_data: { metadata: { user_id: user.id, interval } },
        success_url: body.success_url,
        cancel_url: body.cancel_url,
      });
      return { url: session.url };
    }

    case 'portal': {
      const stripe = needStripe(env);
      if (!isUrl(body.return_url)) throw new PaymentsError(400, 'invalid_return_url');
      const customer = await ensureCustomer(db, stripe, user);
      const s = await stripe.post<{ url: string }>('/v1/billing_portal/sessions', { customer, return_url: body.return_url });
      return { url: s.url };
    }

    // ---------- Модератор: провести одобренную выплату ----------
    case 'payout_execute': {
      if (!(await isStaff(db, user.id))) throw new PaymentsError(403, 'forbidden');
      const payout = await db.one<Record<string, any>>('payouts', { id: String(body.payout_id ?? '') });
      if (!payout) throw new PaymentsError(404, 'payout_not_found');
      if (payout.status !== 'approved') throw new PaymentsError(409, 'invalid_status');
      if (payout.method === 'usdt') {
        // Переводы USDT отправляет команда вручную; после отправки — payout_mark_paid
        return db.rpc('svc_payout_processing', { p_payout: payout.id, p_provider_ref: 'manual' });
      }
      const stripe = needStripe(env);
      const acct = await db.one<{ account_id: string; payouts_enabled: boolean }>('connect_accounts', { user_id: payout.user_id });
      if (!acct?.payouts_enabled) throw new PaymentsError(409, 'payouts_not_setup');
      try {
        const tr = await stripe.post<{ id: string }>(
          '/v1/transfers',
          { amount: Number(payout.amount_cents), currency: 'usd', destination: acct.account_id, metadata: { payout_id: payout.id } },
          { idempotencyKey: `payout-${payout.id}` },
        );
        await db.rpc('svc_payout_processing', { p_payout: payout.id, p_provider_ref: tr.id });
        // Деньги ушли на счёт исполнителя в Stripe; до карты/банка — по графику Stripe (2–7 рабочих дней)
        return db.rpc('svc_payout_paid', { p_payout: payout.id });
      } catch (e) {
        if (e instanceof StripeError) {
          return db.rpc('svc_payout_failed', { p_payout: payout.id, p_reason: e.message });
        }
        throw e;
      }
    }

    case 'payout_mark_paid': {
      if (!(await isStaff(db, user.id))) throw new PaymentsError(403, 'forbidden');
      return db.rpc('svc_payout_paid', { p_payout: String(body.payout_id ?? '') });
    }

    // ---------- Модератор: провести возврат картой ----------
    case 'refund_execute': {
      if (!(await isStaff(db, user.id))) throw new PaymentsError(403, 'forbidden');
      const refund = await db.one<Record<string, any>>('refund_requests', { id: String(body.refund_id ?? '') });
      if (!refund) throw new PaymentsError(404, 'refund_not_found');
      if (!['created', 'reviewing'].includes(refund.status)) throw new PaymentsError(409, 'invalid_status');
      const payment = refund.payment_id ? await db.one<Record<string, any>>('payments', { id: refund.payment_id }) : null;
      if (!payment || payment.provider !== 'stripe' || !payment.provider_payment) throw new PaymentsError(409, 'manual_refund_required');
      const stripe = needStripe(env);
      await stripe.post(
        '/v1/refunds',
        { payment_intent: payment.provider_payment, amount: Number(refund.amount_cents), metadata: { refund_id: refund.id } },
        { idempotencyKey: `refund-${refund.id}` },
      );
      return db.rpc('svc_refund_done', { p_refund: refund.id, p_amount_cents: Number(refund.amount_cents) });
    }

    default:
      throw new PaymentsError(400, 'unknown_action');
  }
}

// ---------- Вебхук Stripe ----------
type StripeEvent = { id: string; type: string; data: { object: Record<string, any> }; account?: string };

export async function handleStripeWebhook(env: PaymentsEnv, db: PaymentsDb, raw: string, signature: string | null): Promise<{ ok: true; duplicate?: boolean }> {
  if (!env.stripeWebhookSecret) throw new PaymentsError(503, 'payments_unavailable');
  if (!(await verifyStripeSignature(raw, signature, env.stripeWebhookSecret))) throw new PaymentsError(400, 'bad_signature');
  const event = JSON.parse(raw) as StripeEvent;
  const fresh = await db.rpc<boolean>('svc_event_begin', { p_id: event.id, p_provider: 'stripe', p_type: event.type, p_payload: event });
  if (!fresh) return { ok: true, duplicate: true };

  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (o.mode === 'payment' && o.payment_status === 'paid') {
        await db.rpc('svc_payment_succeeded', { p_provider_ref: o.id, p_provider_payment: o.payment_intent ?? null });
      } else if (o.mode === 'subscription' && o.subscription && env.stripe) {
        const sub = await env.stripe.get<Record<string, any>>(`/v1/subscriptions/${o.subscription}`);
        await syncSubscription(db, sub, o.metadata?.user_id ?? o.client_reference_id);
        if (o.customer && (o.metadata?.user_id ?? o.client_reference_id)) {
          await db.rpc('svc_customer_upsert', { p_user: o.metadata?.user_id ?? o.client_reference_id, p_customer: o.customer });
        }
      }
      break;
    case 'checkout.session.async_payment_failed':
      await db.rpc('svc_payment_failed', { p_provider_ref: o.id, p_reason: 'async_payment_failed', p_canceled: false });
      break;
    case 'checkout.session.expired':
      if (o.mode === 'payment') await db.rpc('svc_payment_failed', { p_provider_ref: o.id, p_reason: 'expired', p_canceled: true });
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(db, o, o.metadata?.user_id);
      break;
    case 'invoice.paid': {
      // История оплат подписки
      const subId = typeof o.subscription === 'string' ? o.subscription : o.parent?.subscription_details?.subscription;
      const userId =
        o.subscription_details?.metadata?.user_id ??
        o.parent?.subscription_details?.metadata?.user_id ??
        (subId ? await db.rpc<string | null>('svc_subscription_by_id', { p_subscription: subId }) : null);
      if (userId && Number(o.amount_paid) > 0) {
        const existing = await db.one('payments', { provider_ref: o.id });
        if (!existing) {
          await db.rpc('svc_payment_create', {
            p_user: userId,
            p_kind: 'subscription',
            p_provider: 'stripe',
            p_currency: 'USD',
            p_amount_cents: Number(o.amount_paid),
            p_provider_ref: o.id,
            p_meta: { subscription: subId ?? null, period_end: o.period_end ?? null },
          });
        }
        await db.rpc('svc_payment_succeeded', { p_provider_ref: o.id, p_provider_payment: o.payment_intent ?? null });
      }
      break;
    }
    case 'account.updated':
      await db.rpc('svc_connect_update_by_account', { p_account: o.id, p_details: !!o.details_submitted, p_payouts: !!o.payouts_enabled });
      break;
    case 'transfer.reversed':
      if (o.metadata?.payout_id) await db.rpc('svc_payout_failed', { p_payout: o.metadata.payout_id, p_reason: 'transfer_reversed' });
      break;
    case 'charge.refunded': {
      for (const r of o.refunds?.data ?? []) {
        if (r.metadata?.refund_id && r.status === 'succeeded') {
          await db.rpc('svc_refund_done', { p_refund: r.metadata.refund_id, p_amount_cents: Number(r.amount) });
        }
      }
      break;
    }
  }
  await db.rpc('svc_event_done', { p_id: event.id });
  return { ok: true };
}

async function syncSubscription(db: PaymentsDb, sub: Record<string, any>, userId?: string | null) {
  const uid = userId ?? sub.metadata?.user_id ?? (await db.rpc<string | null>('svc_subscription_by_id', { p_subscription: sub.id }));
  if (!uid) return;
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval ?? item?.plan?.interval ?? sub.metadata?.interval ?? 'month';
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await db.rpc('svc_subscription_update', {
    p_user: uid,
    p_interval: interval === 'year' ? 'year' : 'month',
    p_status: sub.status,
    p_subscription: sub.id,
    p_period_end: periodEnd ? new Date(Number(periodEnd) * 1000).toISOString() : null,
    p_cancel_at_period_end: !!sub.cancel_at_period_end,
  });
}

// ---------- IPN NOWPayments ----------
export async function handleNowPaymentsIpn(env: PaymentsEnv, db: PaymentsDb, body: Record<string, any>, signature: string | null) {
  if (!env.nowpaymentsIpnSecret) throw new PaymentsError(503, 'crypto_unavailable');
  if (!(await verifyNowPayments(body, signature, env.nowpaymentsIpnSecret))) throw new PaymentsError(400, 'bad_signature');
  const ref = String(body.payment_id);
  const eventId = `np_${ref}_${body.payment_status}`;
  const fresh = await db.rpc<boolean>('svc_event_begin', { p_id: eventId, p_provider: 'nowpayments', p_type: String(body.payment_status), p_payload: body });
  if (!fresh) return { ok: true, duplicate: true };
  if (body.payment_status === 'finished') {
    await db.rpc('svc_payment_succeeded', { p_provider_ref: ref, p_provider_payment: body.outcome_amount ? String(body.outcome_amount) : null });
  } else if (['failed', 'expired', 'refunded'].includes(body.payment_status)) {
    await db.rpc('svc_payment_failed', { p_provider_ref: ref, p_reason: String(body.payment_status), p_canceled: body.payment_status === 'expired' });
  }
  await db.rpc('svc_event_done', { p_id: eventId });
  return { ok: true };
}

// ---------- Курсы ЦБ РФ ----------
/** Из ответа cbr-xml-daily.ru: сколько единиц валюты за 1 доллар */
export function ratesFromCbr(json: { Valute: Record<string, { Nominal: number; Value: number }> }): Record<string, number> {
  const usd = json.Valute.USD;
  if (!usd) throw new Error('no USD rate');
  const rubPerUsd = usd.Value / usd.Nominal;
  const out: Record<string, number> = { RUB: Number(rubPerUsd.toFixed(6)) };
  for (const code of ['EUR', 'AED', 'KZT']) {
    const v = json.Valute[code];
    if (v) out[code] = Number((rubPerUsd / (v.Value / v.Nominal)).toFixed(6));
  }
  return out;
}
