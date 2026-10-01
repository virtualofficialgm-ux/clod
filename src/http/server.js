import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { MARKETS, PRODUCTS, PARTNERS, SERVICE_API_KEYS, SEED_USERS, SEED_MERCHANTS } from '../config.js';
import { PayError, format } from '../money.js';
import { quote } from '../fees.js';
import { renderDocument, renderCheckout } from './pages.js';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const MAX_BODY = 64 * 1024;

export function createHttpServer({ level = process.env.PARRI_PAY_LEVEL ?? 'connect', baseUrl = '' } = {}) {
  const app = createApp({ level, baseUrl, autoProcessMs: 1500 });
  const { service, partners, receiveWebhook, clock } = app;
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, handler });
  };

  // --- Auth (sandbox) -------------------------------------------------------
  // Users are identified by X-User-Id in the sandbox. In production this is the
  // brand's session / OAuth token; brand services use API keys.
  const user = (req) => {
    const id = req.headers['x-user-id'];
    if (!id || !(service.store.users.has(id) || service.store.merchants.has(id))) throw new PayError('unauthorized', 'Требуется вход', 401);
    return id;
  };
  const serviceProduct = (req) => {
    const product = SERVICE_API_KEYS[req.headers['x-api-key']];
    if (!product) throw new PayError('unauthorized', 'Неверный API-ключ сервиса', 401);
    return product;
  };
  const idemKey = (req) => req.headers['idempotency-key'];

  // --- Meta -----------------------------------------------------------------
  route('GET', '/api/meta', () => ({
    ...service.capabilities(),
    markets: Object.keys(MARKETS).map((m) => service.marketInfo(m)),
    products: Object.entries(PRODUCTS).map(([id, p]) => ({ id, title: p.title, escrow: p.escrow, parriFeeBps: p.parriFeeBps, bonusBps: p.bonusBps, plans: p.plans ?? null })),
    partners: Object.entries(PARTNERS).map(([id, p]) => ({ id, title: p.title, acquiringFeeBps: p.acquiringFeeBps })),
    sandbox: { users: SEED_USERS, merchants: SEED_MERCHANTS, serviceKeys: SERVICE_API_KEYS, clockOffsetDays: clock.offsetMs / 86_400_000 },
  }));

  // --- User API -------------------------------------------------------------
  route('GET', '/api/me', ({ req }) => {
    const id = user(req);
    const party = service.party(id);
    return { ...party, isBusiness: service.isMerchant(id), market: party.market ? service.marketInfo(party.market) : null };
  });
  route('GET', '/api/me/balance', ({ req }) => service.balance(user(req)));
  route('GET', '/api/me/operations', ({ req }) => service.operations(user(req)));
  route('GET', '/api/me/documents', ({ req }) => service.documentsOf(user(req)));
  route('GET', '/api/me/notifications', ({ req }) => service.notificationsOf(user(req)));
  route('GET', '/api/me/subscriptions', ({ req }) => service.subscriptionsOf(user(req)));

  route('POST', '/api/quote', ({ req, body }) => {
    const me = service.party(user(req));
    return quote({ market: me.market, product: body.product, amount: Number(body.amount), payerCurrency: body.currency });
  });

  route('GET', '/api/orders/:id', ({ req, params }) => {
    const id = user(req);
    const order = service.getOrder(params.id);
    if (![order.payerId, order.payeeId].includes(id)) throw new PayError('order_not_found', 'Заказ не найден', 404);
    return { ...order, payments: order.paymentIds.map((p) => service.getPayment(p)) };
  });
  route('POST', '/api/orders/:id/payments', ({ req, params, body }) => {
    const id = user(req);
    return service.idempotency.run(`pay:${id}`, idemKey(req), { params, body }, () => service.startPayment(params.id, {
      actorId: id, currency: body.currency, savePaymentMethod: Boolean(body.savePaymentMethod),
    }));
  });
  route('POST', '/api/orders/:id/complete', ({ req, params }) => service.completeOrder(params.id, user(req)));
  route('POST', '/api/orders/:id/cancel', ({ req, params }) => service.cancelOrder(params.id, user(req)));
  route('POST', '/api/orders/:id/refunds', ({ req, params, body }) => {
    const id = user(req);
    return service.idempotency.run(`refund:${id}`, idemKey(req), { params, body }, () => service.requestRefund(params.id, {
      amount: body.amount == null ? undefined : Number(body.amount), reason: body.reason, actorId: id,
    }));
  });
  route('POST', '/api/payouts', ({ req, body }) => {
    const id = user(req);
    return service.idempotency.run(`payout:${id}`, idemKey(req), body, () => service.requestPayout(id, { amount: Number(body.amount), destination: body.destination }));
  });
  route('POST', '/api/subscriptions', ({ req, body }) => {
    const id = user(req);
    return service.idempotency.run(`sub:${id}`, idemKey(req), body, () => service.subscribe(id, body.planId, { currency: body.currency }));
  });
  route('POST', '/api/subscriptions/:id/cancel', ({ req, params }) => service.cancelSubscription(user(req), params.id));

  // --- Brand service API (Tasks, Fit, Food) ---------------------------------
  route('POST', '/api/service/orders', ({ req, body }) => {
    const product = serviceProduct(req);
    return service.createOrder({ product, externalRef: body.externalRef, payerId: body.payerId, payeeId: body.payeeId, amount: Number(body.amount), description: body.description });
  });
  route('GET', '/api/service/orders/:id', ({ req, params }) => {
    const product = serviceProduct(req);
    const order = service.getOrder(params.id);
    if (order.product !== product) throw new PayError('order_not_found', 'Заказ не найден', 404);
    return order;
  });
  route('POST', '/api/service/orders/:id/complete', ({ req, params }) => service.completeOrder(params.id, `service:${serviceProduct(req)}`));
  route('POST', '/api/service/orders/:id/refunds', ({ req, params, body }) => {
    const product = serviceProduct(req);
    return service.idempotency.run(`svc-refund:${product}`, idemKey(req), { params, body }, () => service.requestRefund(params.id, {
      amount: body.amount == null ? undefined : Number(body.amount), reason: body.reason, actorId: `service:${product}`,
    }));
  });

  // --- Pay Platform: business cabinet & reconciliation ------------------------
  route('GET', '/api/business/summary', ({ req }) => {
    const product = serviceProduct(req);
    const merchant = PRODUCTS[product].merchant;
    if (!merchant) throw new PayError('not_a_business', 'У продукта нет бизнес-счёта', 404);
    return service.businessSummary(merchant);
  });
  route('GET', '/api/business/reconciliation/:partnerId', ({ req, params }) => {
    serviceProduct(req);
    return service.reconciliation(params.partnerId);
  });
  route('GET', '/api/network', () => {
    service.require('ownSettlement');
  });

  // --- Partner webhooks -----------------------------------------------------
  route('POST', '/api/webhooks/partners/:partnerId', ({ req, params, raw }) => receiveWebhook(params.partnerId, raw, req.headers['x-partner-signature']));

  // --- Sandbox --------------------------------------------------------------
  route('POST', '/api/sandbox/orders', ({ req, body }) => {
    // Acts as a brand service creating an order for the signed-in payer.
    const payerId = user(req);
    return service.createOrder({ product: body.product, externalRef: `demo-${randomUUID()}`, payerId, payeeId: body.payeeId, amount: Number(body.amount), description: body.description });
  });
  route('POST', '/api/sandbox/process', async () => {
    for (const p of Object.values(partners)) await p.processPending();
    return { ok: true };
  });
  route('POST', '/api/sandbox/settle', () => ({ settled: service.settle({ force: true }) }));
  route('POST', '/api/sandbox/advance', async ({ body }) => {
    clock.offsetMs += Number(body.days ?? 1) * 86_400_000;
    const billed = await service.billSubscriptions();
    const settled = service.settle();
    return { clockOffsetDays: clock.offsetMs / 86_400_000, billed, settled };
  });

  route('GET', '/api/documents/:id', ({ req, params, url }) => {
    const doc = service.getDocument(params.id, user(req));
    // Rendered fragment is returned inside JSON; the client shows it in a dialog.
    return url.searchParams.get('view') === 'html' ? { document: doc, html: renderDocument(doc, format) } : doc;
  });

  route('GET', '/sandbox-partner/:partnerId/checkout/:opId', ({ params }) => {
    const op = partners[params.partnerId]?.getOperation(params.opId);
    if (!op) throw new PayError('not_found', 'Платёж не найден', 404);
    return { page: renderCheckout(params.partnerId, PARTNERS[params.partnerId].title, op, format) };
  });
  route('POST', '/sandbox-partner/:partnerId/checkout/:opId', async ({ params, body }) => {
    const partner = partners[params.partnerId];
    if (!partner?.getOperation(params.opId)) throw new PayError('not_found', 'Платёж не найден', 404);
    await partner.completeCheckout(params.opId, body.outcome);
    return { redirect: `/?checkout=${body.outcome}` };
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/sandbox-partner/')) {
        return await serveStatic(url.pathname, res);
      }
      const match = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
      if (!match) throw new PayError('not_found', 'Не найдено', 404);
      const values = match.re.exec(url.pathname).slice(1).map(decodeURIComponent);
      const params = Object.fromEntries(match.keys.map((k, i) => [k, values[i]]));
      const raw = req.method === 'POST' ? await readBody(req) : '';
      const body = parseBody(raw, req.headers['content-type']);
      const result = await match.handler({ req, url, params, body, raw });
      if (result?.redirect) {
        res.writeHead(303, { location: result.redirect });
        return res.end();
      }
      if (result?.page) {
        res.writeHead(200, { 'content-type': MIME['.html'], 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" });
        return res.end(result.page);
      }
      send(res, 200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof PayError) return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
      if (err instanceof SyntaxError) return send(res, 400, { error: { code: 'invalid_json', message: 'Некорректный JSON' } });
      console.error(err);
      send(res, 500, { error: { code: 'internal', message: 'Внутренняя ошибка' } });
    }
  });
  return { server, app };
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new PayError('body_too_large', 'Слишком большой запрос', 413));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw, type = '') {
  if (!raw) return {};
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) throw new PayError('not_found', 'Не найдено', 404);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    throw new PayError('not_found', 'Не найдено', 404);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const { server, app } = createHttpServer();
  server.listen(port, () => {
    console.log(`Parri Pay (${app.service.capabilities().levels.find((l) => l.id === app.service.level).title}) — http://localhost:${port}`);
  });
}
