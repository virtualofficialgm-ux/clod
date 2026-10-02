/**
 * Поддельный Stripe для локальной проверки без ключей (и для тестов): тот же интерфейс StripeApi,
 * что и настоящий клиент, плюс страницы «оплатить / отклонить», «пройти проверку Connect»,
 * «отменить подписку». Действия на страницах порождают настоящие события, подписанные секретом
 * вебхука, и доставляют их в тот же обработчик, что и в продакшене.
 * Без зависимостей от Node — используется и в devstack, и в демо в браузере.
 */
import { signStripePayload, StripeError, type StripeApi } from '../../../supabase/functions/_shared/stripe.ts';

type Obj = Record<string, any>;

export interface FakeStripe {
  api: StripeApi;
  /** Страницы: возвращает HTML или редирект; null — путь не наш */
  page(method: string, path: string, form: URLSearchParams): Promise<{ status: number; html?: string; redirect?: string } | null>;
  /** Для тестов: оплатить/отклонить сессию программно */
  completeCheckout(sessionId: string, ok?: boolean): Promise<void>;
  completeConnect(accountId: string): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  state: { sessions: Map<string, Obj>; accounts: Map<string, Obj>; subscriptions: Map<string, Obj>; transfers: Obj[]; refunds: Obj[] };
}

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
const now = () => Math.floor(Date.now() / 1000);
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#F6F6F8;--card:#fff;--text:#0B0B0F;--muted:#5B5B66;--fill:#EEEEF1;--accent:#FF5428}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#161619;--text:#F5F5F7;--muted:#A1A1AA;--fill:#1F1F23}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:17px/1.45 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;padding:16px}
.card{width:100%;max-width:420px;background:var(--card);border-radius:28px;padding:28px;box-shadow:0 10px 40px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:16px}
.tag{align-self:flex-start;background:var(--fill);border-radius:99px;padding:4px 12px;font-size:13px;font-weight:700;color:var(--muted)}
h1{margin:0;font-size:26px;line-height:1.15;letter-spacing:-.02em}.sum{font-size:44px;font-weight:800;letter-spacing:-.03em}
p{margin:0;color:var(--muted)}form{display:flex;flex-direction:column;gap:10px}
button{height:56px;border:0;border-radius:99px;font:700 18px system-ui;cursor:pointer}
.pay{background:var(--accent);color:#fff}.alt{background:var(--fill);color:var(--text)}
</style></head><body><main class="card"><span class="tag">Тестовый режим Stripe · локально</span>${body}</main></body></html>`;
}

export function createFakeStripe(opts: { webhookSecret: string; deliver: (raw: string, signature: string) => Promise<void>; pagesBase: string }): FakeStripe {
  const customers = new Map<string, Obj>();
  const sessions = new Map<string, Obj>();
  const accounts = new Map<string, Obj>();
  const subscriptions = new Map<string, Obj>();
  const transfers: Obj[] = [];
  const refunds: Obj[] = [];
  const idem = new Map<string, Obj>();

  const emit = async (type: string, object: Obj) => {
    const raw = JSON.stringify({ id: id('evt'), type, created: now(), data: { object } });
    await opts.deliver(raw, await signStripePayload(raw, opts.webhookSecret));
  };

  const api: StripeApi = {
    async post(path, rawParams = {}, o = {}) {
      const params = rawParams as Obj;
      if (o.idempotencyKey && idem.has(o.idempotencyKey)) return idem.get(o.idempotencyKey) as any;
      let out: Obj;
      if (path === '/v1/customers') {
        out = { id: id('cus'), object: 'customer', email: params.email ?? null, metadata: params.metadata ?? {} };
        customers.set(out.id, out);
      } else if (path === '/v1/checkout/sessions') {
        const sid = id('cs_test');
        out = {
          id: sid,
          object: 'checkout.session',
          mode: params.mode,
          customer: params.customer,
          client_reference_id: params.client_reference_id,
          metadata: params.metadata ?? {},
          line_items: params.line_items,
          amount_total: (params.line_items?.[0]?.price_data?.unit_amount ?? 0) * (params.line_items?.[0]?.quantity ?? 1),
          success_url: String(params.success_url).replace('{CHECKOUT_SESSION_ID}', sid),
          cancel_url: params.cancel_url,
          status: 'open',
          payment_status: 'unpaid',
          payment_intent: null,
          subscription: null,
          subscription_data: params.subscription_data,
          url: `${opts.pagesBase}/dev/stripe/checkout/${sid}`,
        };
        sessions.set(sid, out);
      } else if (path === '/v1/accounts') {
        out = { id: id('acct'), object: 'account', type: 'express', email: params.email ?? null, details_submitted: false, payouts_enabled: false, metadata: params.metadata ?? {} };
        accounts.set(out.id, out);
      } else if (path === '/v1/account_links') {
        if (!accounts.has(String(params.account))) throw new StripeError(404, 'resource_missing', 'No such account');
        const acct = accounts.get(String(params.account))!;
        acct.return_url = params.return_url;
        out = { object: 'account_link', url: `${opts.pagesBase}/dev/stripe/connect/${params.account}` };
      } else if (path === '/v1/billing_portal/sessions') {
        out = { object: 'billing_portal.session', url: `${opts.pagesBase}/dev/stripe/portal/${params.customer}?return=${encodeURIComponent(String(params.return_url))}` };
      } else if (path === '/v1/transfers') {
        const acct = accounts.get(String(params.destination));
        if (!acct?.payouts_enabled) throw new StripeError(400, 'account_invalid', 'Destination account cannot receive transfers');
        out = { id: id('tr'), object: 'transfer', amount: params.amount, currency: params.currency, destination: params.destination, metadata: params.metadata ?? {} };
        transfers.push(out);
      } else if (path === '/v1/refunds') {
        out = { id: id('re'), object: 'refund', amount: params.amount, payment_intent: params.payment_intent, status: 'succeeded', metadata: params.metadata ?? {} };
        refunds.push(out);
      } else if (/^\/v1\/subscriptions\/[^/]+$/.test(path)) {
        const sub = subscriptions.get(path.split('/').pop()!);
        if (!sub) throw new StripeError(404, 'resource_missing', 'No such subscription');
        Object.assign(sub, params);
        out = sub;
      } else {
        throw new StripeError(400, 'fake_not_supported', `FakeStripe: POST ${path}`);
      }
      if (o.idempotencyKey) idem.set(o.idempotencyKey, out);
      return out as any;
    },
    async get(path) {
      const [, , kind, key] = path.split('/');
      const map = kind === 'checkout' ? sessions : kind === 'accounts' ? accounts : kind === 'subscriptions' ? subscriptions : null;
      const realKey = kind === 'checkout' ? path.split('/').pop()! : key!;
      const v = map?.get(realKey);
      if (!v) throw new StripeError(404, 'resource_missing', `FakeStripe: GET ${path}`);
      return v as any;
    },
  };

  async function completeCheckout(sessionId: string, ok = true) {
    const s = sessions.get(sessionId);
    if (!s || s.status !== 'open') return;
    if (!ok) {
      s.status = 'expired';
      await emit('checkout.session.expired', s);
      return;
    }
    s.status = 'complete';
    s.payment_status = 'paid';
    if (s.mode === 'payment') {
      s.payment_intent = id('pi');
      await emit('checkout.session.completed', s);
    } else {
      const price = s.line_items?.[0]?.price_data ?? {};
      const interval = price.recurring?.interval ?? 'month';
      const end = now() + (interval === 'year' ? 365 : 30) * 86400;
      const sub: Obj = {
        id: id('sub'),
        object: 'subscription',
        status: 'active',
        customer: s.customer,
        cancel_at_period_end: false,
        metadata: s.subscription_data?.metadata ?? s.metadata ?? {},
        items: { data: [{ price: { recurring: { interval }, unit_amount: price.unit_amount }, current_period_end: end }] },
      };
      subscriptions.set(sub.id, sub);
      s.subscription = sub.id;
      await emit('checkout.session.completed', s);
      await emit('invoice.paid', {
        id: id('in'),
        object: 'invoice',
        subscription: sub.id,
        amount_paid: price.unit_amount ?? 0,
        payment_intent: id('pi'),
        subscription_details: { metadata: sub.metadata },
        period_end: end,
      });
    }
  }

  async function completeConnect(accountId: string) {
    const a = accounts.get(accountId);
    if (!a) return;
    a.details_submitted = true;
    a.payouts_enabled = true;
    await emit('account.updated', a);
  }

  async function cancelSubscription(subscriptionId: string) {
    const sub = subscriptions.get(subscriptionId);
    if (!sub) return;
    sub.status = 'canceled';
    await emit('customer.subscription.deleted', sub);
  }

  async function page(method: string, path: string, form: URLSearchParams) {
    let m: RegExpExecArray | null;
    if ((m = /^\/dev\/stripe\/checkout\/([\w]+)$/.exec(path))) {
      const s = sessions.get(m[1]!);
      if (!s) return { status: 404, html: shell('Не найдено', '<h1>Сессия не найдена</h1>') };
      if (method === 'POST') {
        const ok = form.get('result') === 'pay';
        await completeCheckout(s.id, ok);
        return { status: 303, redirect: ok ? s.success_url : s.cancel_url };
      }
      const amount = (s.amount_total / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'USD' });
      const what = s.mode === 'subscription' ? 'Подписка Parri Pro' : 'Пополнение баланса Parri';
      return {
        status: 200,
        html: shell(
          'Оплата',
          `<h1>${esc(what)}</h1><div class="sum">${esc(amount)}</div><p>Карта, Apple Pay или Google Pay — в настоящем Stripe. Здесь деньги не списываются.</p>
          <form method="post"><button class="pay" name="result" value="pay">Оплатить</button><button class="alt" name="result" value="decline">Отклонить платёж</button></form>`,
        ),
      };
    }
    if ((m = /^\/dev\/stripe\/connect\/([\w]+)$/.exec(path))) {
      const a = accounts.get(m[1]!);
      if (!a) return { status: 404, html: shell('Не найдено', '<h1>Аккаунт не найден</h1>') };
      if (method === 'POST') {
        await completeConnect(a.id);
        return { status: 303, redirect: a.return_url };
      }
      return {
        status: 200,
        html: shell(
          'Настройка выплат',
          `<h1>Настройка выплат</h1><p>В настоящем Stripe здесь проверка личности и реквизиты банка. Банковские данные хранятся у Stripe, не в Parri.</p>
          <form method="post"><button class="pay">Завершить проверку</button></form>`,
        ),
      };
    }
    if ((m = /^\/dev\/stripe\/portal\/([\w]+)$/.exec(path))) {
      const customer = m[1]!;
      const back = form.get('return') ?? '';
      const sub = [...subscriptions.values()].find((x) => x.customer === customer && x.status === 'active');
      if (method === 'POST') {
        if (sub) await cancelSubscription(sub.id);
        return { status: 303, redirect: back };
      }
      return {
        status: 200,
        html: shell(
          'Управление подпиской',
          `<h1>Управление подпиской</h1><p>${sub ? 'Активна подписка Parri Pro.' : 'Активной подписки нет.'}</p>
          <form method="post" action="?return=${encodeURIComponent(back)}">${sub ? '<button class="alt">Отменить подписку</button>' : ''}</form>
          <a href="${esc(back)}">Назад в Parri</a>`,
        ),
      };
    }
    return null;
  }

  return { api, page, completeCheckout, completeConnect, cancelSubscription, state: { sessions, accounts, subscriptions, transfers, refunds } };
}
