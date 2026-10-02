/**
 * Деньги в devstack: тот же обработчик, что и в Edge Functions (supabase/functions/payments/handler.ts).
 * С STRIPE_SECRET_KEY — настоящий Stripe (тестовый режим), без ключа — FakeStripe со страницами оплаты.
 * USDT — поддельный NOWPayments: страница «отметить оплату» шлёт подписанный IPN.
 */
import { createStripeApi, signNowPayments } from '../../../supabase/functions/_shared/stripe.ts';
import {
  handleAction,
  handleNowPaymentsIpn,
  handleStripeWebhook,
  type NowPaymentsApi,
  type PaymentsDb,
  type PaymentsEnv,
} from '../../../supabase/functions/payments/handler.ts';
import { pool } from './db.ts';
import { createFakeStripe, type FakeStripe } from './fakeStripe.ts';

const TABLES = new Set(['payments', 'payouts', 'refund_requests', 'stripe_customers', 'connect_accounts', 'subscriptions', 'profiles']);

/** Сервисные вызовы напрямую в Postgres (как service_role через PostgREST) */
export const devPaymentsDb: PaymentsDb = {
  async rpc(fn, args) {
    if (!/^[a-z_]+$/.test(fn)) throw new Error('bad function name');
    const keys = Object.keys(args);
    const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = args[k];
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const r = await pool.query(`select to_jsonb(public.${fn}(${named})) as r`, values);
    return r.rows[0]?.r;
  },
  async one(table, match) {
    if (!TABLES.has(table)) throw new Error('bad table');
    const keys = Object.keys(match);
    const where = keys.map((k, i) => `${k.replace(/[^a-z_]/g, '')} = $${i + 1}`).join(' and ');
    const r = await pool.query(`select to_jsonb(t) as r from public.${table} t where ${where} limit 1`, keys.map((k) => match[k]));
    return r.rows[0]?.r ?? null;
  },
};

const PORT = Number(process.env.DEVSTACK_PORT ?? 54321);
const PAGES = process.env.DEVSTACK_PUBLIC_URL ?? `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_devstack_local';
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET ?? 'ipn_devstack_local';

export let fakeStripe: FakeStripe | null = null;

const fakePayments = new Map<string, { id: string; amount: number; address: string; network: string; order_id: string }>();
const fakeNowPayments: NowPaymentsApi = {
  async createPayment(p) {
    const id = String(Date.now()) + String(Math.floor(Math.random() * 1000));
    const address = `T${crypto.randomUUID().replace(/-/g, '').slice(0, 33)}`;
    fakePayments.set(id, { id, amount: p.price_amount, address, network: p.pay_currency, order_id: p.order_id });
    return { payment_id: id, pay_address: address, pay_amount: p.price_amount };
  },
};

export const paymentsEnv: PaymentsEnv = {
  stripe: null,
  stripeWebhookSecret: WEBHOOK_SECRET,
  nowpayments: process.env.NOWPAYMENTS_API_KEY ? null : fakeNowPayments,
  nowpaymentsIpnSecret: IPN_SECRET,
};

if (process.env.STRIPE_SECRET_KEY) {
  paymentsEnv.stripe = createStripeApi(process.env.STRIPE_SECRET_KEY);
} else {
  fakeStripe = createFakeStripe({
    webhookSecret: WEBHOOK_SECRET,
    pagesBase: PAGES,
    deliver: async (raw, sig) => {
      await handleStripeWebhook(paymentsEnv, devPaymentsDb, raw, sig);
    },
  });
  paymentsEnv.stripe = fakeStripe.api;
}

export async function paymentsAction(userId: string, body: Record<string, unknown>) {
  const u = await pool.query<{ email: string }>(`select email from auth.users where id = $1`, [userId]);
  return handleAction(paymentsEnv, devPaymentsDb, { id: userId, email: u.rows[0]?.email }, body);
}

export const stripeWebhook = (raw: string, sig: string | null) => handleStripeWebhook(paymentsEnv, devPaymentsDb, raw, sig);
export const cryptoWebhook = (body: Record<string, unknown>, sig: string | null) => handleNowPaymentsIpn(paymentsEnv, devPaymentsDb, body, sig);

/** Страница «оплатить USDT» для поддельного NOWPayments */
export async function nowPaymentsPage(method: string, id: string): Promise<{ status: number; html?: string; redirect?: string }> {
  const p = fakePayments.get(id);
  if (!p) return { status: 404, html: '<h1>Платёж не найден</h1>' };
  if (method === 'POST') {
    const body = { payment_id: p.id, payment_status: 'finished', order_id: p.order_id, price_amount: p.amount, pay_address: p.address };
    await cryptoWebhook(body, await signNowPayments(body, IPN_SECRET));
    return { status: 200, html: '<h1>Оплата отмечена. Можно вернуться в Parri.</h1>' };
  }
  return {
    status: 200,
    html: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:24px">
      <h1>Тестовый перевод USDT</h1><p>${p.amount} USDT (${p.network}) на ${p.address}</p>
      <form method="post"><button style="height:52px;padding:0 24px;border-radius:99px;border:0;background:#FF5428;color:#fff;font-weight:700">Отметить перевод как полученный</button></form></body>`,
  };
}

/** Курсы: без сети — фиксированные значения, чтобы проверка шла офлайн */
export async function refreshRates() {
  try {
    const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const { ratesFromCbr } = await import('../../../supabase/functions/payments/handler.ts');
      return devPaymentsDb.rpc('svc_set_rates', { p_rates: ratesFromCbr(await res.json()), p_source: 'cbr' });
    }
  } catch {}
  return 0;
}
