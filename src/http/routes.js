import { randomUUID } from 'node:crypto';
import { MARKETS, PRODUCTS, PARTNERS, SERVICE_API_KEYS, SEED_USERS, SEED_MERCHANTS, SANDBOX_CONTACTS } from '../config.js';
import { PayService } from '../services/pay.js';
import { PayError, format } from '../money.js';
import { quote, topupQuote } from '../fees.js';
import { renderDocument, renderCheckout } from './pages.js';

// Transport-independent API router. The Node server and the in-browser
// standalone build both dispatch requests through it.
export function createRouter({ service, partners, receiveWebhook, clock, keys, keyFactory }) {
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
    return quote({ market: me.market, product: body.product, amount: Number(body.amount), payerCurrency: body.currency, source: body.source ?? 'card' });
  });

  // --- Top-ups --------------------------------------------------------------
  route('POST', '/api/topups/quote', ({ req, body }) => {
    const me = service.party(user(req));
    if (!me.market) throw new PayError('forbidden', 'Пополнение доступно пользователям', 403);
    return topupQuote({ market: me.market, amount: Number(body.amount) });
  });
  route('POST', '/api/topups', ({ req, body }) => {
    const id = user(req);
    return service.idempotency.run(`topup:${id}`, idemKey(req), body, () => service.requestTopup(id, { amount: Number(body.amount) }));
  });

  // --- Transfers to people ----------------------------------------------------
  route('POST', '/api/contacts/match', ({ req, body }) => service.matchContacts(user(req), body.hashes));
  route('POST', '/api/transfers/quote', ({ req, body }) => service.transferQuote(user(req), { type: body.type, amount: Number(body.amount), method: body.method }));
  route('POST', '/api/transfers', ({ req, body }) => {
    const id = user(req);
    const amount = Number(body.amount);
    return service.idempotency.run(`transfer:${id}`, idemKey(req), body, () => (body.type === 'bank'
      ? service.transferToBank(id, { method: body.method, destination: body.destination, recipientName: body.recipientName, amount, message: body.message })
      : service.transferToUser(id, { recipientId: body.recipientId, amount, message: body.message })));
  });

  // --- Parri Key ------------------------------------------------------------
  route('GET', '/api/keys', ({ req }) => {
    const id = user(req);
    return { models: keys.models(id), devices: keys.devicesOf(id), confirmations: keys.pendingConfirmations(id) };
  });
  route('POST', '/api/keys', ({ req, body }) => keys.beginLink(user(req), body.identity));
  route('POST', '/api/keys/:id/activate', ({ req, params, body }) => keys.activate(user(req), params.id, body.signature));
  route('GET', '/api/keys/:id/display', ({ req, params }) => keys.display(user(req), params.id));
  route('POST', '/api/keys/:id/source', ({ req, params, body }) => keys.selectSource(user(req), params.id, { sourceId: body.sourceId, counter: Number(body.counter), signature: body.signature }));
  route('POST', '/api/keys/:id/block', ({ req, params }) => keys.block(user(req), params.id));
  route('POST', '/api/keys/:id/unlink', ({ req, params }) => keys.unlink(user(req), params.id));
  route('POST', '/api/keys/:id/ownership', ({ req, params }) => keys.beginOwnershipCheck(user(req), params.id));
  route('POST', '/api/keys/:id/ownership/verify', ({ req, params, body }) => keys.verifyOwnership(user(req), params.id, body.signature));
  route('POST', '/api/keys/confirmations/:id', ({ req, params, body }) => keys.confirm(user(req), params.id, { signature: body.signature, decline: Boolean(body.decline) }));

  route('GET', '/api/orders/:id', ({ req, params }) => {
    const id = user(req);
    const order = service.getOrder(params.id);
    if (![order.payerId, order.payeeId].includes(id)) throw new PayError('order_not_found', 'Заказ не найден', 404);
    return { ...order, payments: order.paymentIds.map((p) => service.getPayment(p)) };
  });
  route('POST', '/api/orders/:id/payments', ({ req, params, body }) => {
    const id = user(req);
    return service.idempotency.run(`pay:${id}`, idemKey(req), { params, body }, () => service.startPayment(params.id, {
      actorId: id, currency: body.currency, savePaymentMethod: Boolean(body.savePaymentMethod), source: body.source ?? 'card',
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
  // Sandbox device "in the hand": stands in for the physical Parri Key. It only exposes
  // what the hardware does: NFC identity read and signing after physical presence.
  const held = new Map(); // serial -> userId
  const heldDevice = (req, serial) => {
    const device = keyFactory.get(serial);
    if (!device || held.get(serial) !== user(req)) throw new PayError('not_found', 'Устройство не найдено', 404);
    return device;
  };
  route('POST', '/api/sandbox/keys', async ({ req, body }) => {
    const device = await keyFactory.manufacture(body.model ?? 'signature');
    held.set(device.identity.serial, user(req));
    return { serial: device.identity.serial, model: device.identity.model };
  });
  route('GET', '/api/sandbox/keys', ({ req }) => {
    const id = user(req);
    return [...held].filter(([, u]) => u === id).map(([serial]) => ({ serial, model: keyFactory.get(serial).identity.model }));
  });
  route('GET', '/api/sandbox/keys/:serial/nfc', ({ req, params }) => heldDevice(req, params.serial).readIdentity());
  route('POST', '/api/sandbox/keys/:serial/sign', async ({ req, params, body }) => {
    const device = heldDevice(req, params.serial);
    if (!['payment', 'assets'].includes(body.purpose)) throw new PayError('unknown_key', 'Неизвестный ключ');
    try {
      return { signature: await device.sign(body.purpose, String(body.message ?? ''), { presence: Boolean(body.presence) }) };
    } catch (err) {
      throw new PayError(err.code ?? 'device_error', err.message, 409);
    }
  });

  // Sandbox address book of the signed-in user's phone.
  route('GET', '/api/sandbox/contacts', ({ req }) => {
    const me = service.party(user(req));
    const mine = PayService.normalizePhone(me.phone);
    return SANDBOX_CONTACTS.filter((c) => PayService.normalizePhone(c.phone) !== mine);
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

  route('GET', '/sandbox-partner/:partnerId/checkout/:opId', ({ params, url }) => {
    const op = partners[params.partnerId]?.getOperation(params.opId);
    if (!op) throw new PayError('not_found', 'Платёж не найден', 404);
    if (url.searchParams.get('format') === 'json') {
      return { partner: PARTNERS[params.partnerId].title, amount: op.amount, currency: op.currency, description: op.description, status: op.status, savePaymentMethod: op.savePaymentMethod };
    }
    return { page: renderCheckout(params.partnerId, PARTNERS[params.partnerId].title, op, format) };
  });
  route('POST', '/sandbox-partner/:partnerId/checkout/:opId', async ({ params, body }) => {
    const partner = partners[params.partnerId];
    if (!partner?.getOperation(params.opId)) throw new PayError('not_found', 'Платёж не найден', 404);
    await partner.completeCheckout(params.opId, body.outcome);
    return { redirect: `/?checkout=${body.outcome}` };
  });

  // headers: lower-case header map; raw: request body as a string.
  return async function dispatch({ method, url, headers = {}, raw = '' }) {
    const match = routes.find((r) => r.method === method && r.re.test(url.pathname));
    if (!match) throw new PayError('not_found', 'Не найдено', 404);
    const values = match.re.exec(url.pathname).slice(1).map(decodeURIComponent);
    const params = Object.fromEntries(match.keys.map((k, i) => [k, values[i]]));
    const body = parseBody(raw, headers['content-type']);
    return match.handler({ req: { headers }, url, params, body, raw });
  };
}

function parseBody(raw, type = '') {
  if (!raw) return {};
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}
