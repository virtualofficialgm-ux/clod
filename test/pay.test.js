import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { sign } from '../src/partners/sandbox.js';

const AM = 'sandbox-am';

function setup(opts = {}) {
  return createApp({ level: 'platform', duplicateWebhooks: true, ...opts });
}

function assertBalanced(service) {
  for (const [currency, total] of Object.entries(service.ledger.trialBalance())) {
    assert.equal(total, 0, `ledger not balanced in ${currency}`);
  }
}

async function paidTaskOrder(app, amount = 1_000_000) {
  const { service, partners } = app;
  const order = service.createOrder({ product: 'tasks', externalRef: `t-${Math.random()}`, payerId: 'u_anna', payeeId: 'u_boris', amount, description: 'Сборка шкафа' });
  const payment = await service.startPayment(order.id, { actorId: 'u_anna' });
  await partners[AM].completeCheckout(payment.partnerPaymentId, 'success');
  return { order, payment };
}

test('task payment is reserved, released on completion and settled', async () => {
  const app = setup();
  const { service } = app;
  const { order, payment } = await paidTaskOrder(app);

  assert.equal(payment.status, 'succeeded');
  assert.equal(order.status, 'paid');
  assert.equal(order.reservation, 'held');
  let b = service.balance('u_boris').balances[0];
  assert.equal(b.available, 0);
  assert.equal(b.expected.reservedForMyOrders, 1_000_000);
  assert.equal(service.balance('u_anna').balances[0].restricted.reservedInMyPurchases, 1_000_000);

  service.completeOrder(order.id, 'u_anna');
  assert.equal(order.reservation, 'released');
  // 1.8% acquiring + 8% Parri fee are withheld separately.
  assert.equal(order.acquiringFeeCharged, 18_000);
  assert.equal(order.parriFeeCollected, 80_000);
  b = service.balance('u_boris').balances[0];
  assert.equal(b.expected.pendingSettlement, 902_000);
  assert.equal(b.available, 0);

  service.settle({ force: true });
  b = service.balance('u_boris').balances[0];
  assert.equal(b.available, 902_000);
  assert.equal(b.expected.pendingSettlement, 0);
  assertBalanced(service);
});

test('duplicate webhooks and repeated requests never charge twice', async () => {
  const app = setup();
  const { service, partners, receiveWebhook } = app;
  const order = service.createOrder({ product: 'tasks', externalRef: 'dup-1', payerId: 'u_anna', payeeId: 'u_boris', amount: 500_000 });
  const again = service.createOrder({ product: 'tasks', externalRef: 'dup-1', payerId: 'u_anna', payeeId: 'u_boris', amount: 500_000 });
  assert.equal(again.id, order.id, 'same externalRef returns the same order');

  const p1 = await service.idempotency.run('pay:u_anna', 'key-1', { order: order.id }, () => service.startPayment(order.id, { actorId: 'u_anna' }));
  const p2 = await service.idempotency.run('pay:u_anna', 'key-1', { order: order.id }, () => service.startPayment(order.id, { actorId: 'u_anna' }));
  const p3 = await service.startPayment(order.id, { actorId: 'u_anna' }); // double click with a new key
  assert.equal(p1.id, p2.id);
  assert.equal(p1.id, p3.id);
  assert.equal(partners[AM].report().filter((r) => r.kind === 'pay').length, 1);

  await partners[AM].completeCheckout(p1.partnerPaymentId, 'success'); // sandbox delivers each event twice
  // Replay the same event manually once more.
  const event = JSON.stringify({ id: 'evt_manual', type: 'payment.succeeded', data: { partnerPaymentId: p1.partnerPaymentId, amount: p1.quote.payer.total, currency: 'AMD' } });
  await receiveWebhook(AM, event, sign('whsec_sandbox_am', event));
  await receiveWebhook(AM, event, sign('whsec_sandbox_am', event));

  assert.equal(service.ledger.balance(`escrow:${order.id}`, 'AMD'), 500_000);
  assert.equal([...service.store.ledgerTx.keys()].filter((k) => k.startsWith('capture:')).length, 1);
  await assert.rejects(() => service.startPayment(order.id, { actorId: 'u_anna' }), { code: 'order_not_payable' });
  assertBalanced(service);
});

test('idempotency key reused with other parameters is rejected', async () => {
  const { service } = setup();
  await service.idempotency.run('s', 'k', { a: 1 }, async () => 1);
  await assert.rejects(() => service.idempotency.run('s', 'k', { a: 2 }, async () => 2), { code: 'idempotency_conflict' });
});

test('webhook with invalid signature is rejected', async () => {
  const { receiveWebhook } = setup();
  const body = JSON.stringify({ id: 'evt_x', type: 'payment.succeeded', data: {} });
  await assert.rejects(() => receiveWebhook(AM, body, sign('wrong_secret', body)), { code: 'invalid_signature' });
});

test('declined payment can be retried; failure does not touch balances', async () => {
  const { service, partners } = setup();
  const order = service.createOrder({ product: 'tasks', externalRef: 'decl', payerId: 'u_anna', payeeId: 'u_boris', amount: 300_000 });
  const p1 = await service.startPayment(order.id, { actorId: 'u_anna' });
  await partners[AM].completeCheckout(p1.partnerPaymentId, 'decline');
  assert.equal(p1.status, 'failed');
  assert.equal(order.status, 'awaiting_payment');
  const p2 = await service.startPayment(order.id, { actorId: 'u_anna' });
  assert.notEqual(p2.id, p1.id);
  await partners[AM].completeCheckout(p2.partnerPaymentId, 'success');
  assert.equal(order.status, 'paid');
});

test('refund from reservation returns money and releases escrow', async () => {
  const app = setup();
  const { service, partners } = app;
  const { order } = await paidTaskOrder(app, 400_000);
  const refund = await service.requestRefund(order.id, { amount: 100_000, actorId: 'u_boris', reason: 'Частично не выполнено' });
  assert.equal(refund.status, 'processing');
  await assert.rejects(() => service.requestRefund(order.id, { amount: 350_000, actorId: 'u_boris' }), { code: 'refund_exceeds' });
  await partners[AM].processPending();
  assert.equal(refund.status, 'succeeded');
  assert.equal(order.reservation, 'partially_returned');
  assert.equal(order.refundedAmount, 100_000);
  service.completeOrder(order.id, 'u_anna');
  assert.equal(order.payeeNet, 300_000 - 24_000 - 7_200);
  assertBalanced(service);
});

test('refund after release is debited from the payee and Parri returns its share', async () => {
  const app = setup();
  const { service, partners } = app;
  const { order } = await paidTaskOrder(app, 1_000_000);
  service.completeOrder(order.id, 'u_anna');
  service.settle({ force: true });
  await service.requestRefund(order.id, { amount: 500_000, actorId: 'u_boris' });
  await partners[AM].processPending();
  // Payee received 902 000; returns 500 000 minus Parri's 8% share (40 000).
  assert.equal(service.balance('u_boris').balances[0].available, 902_000 - 460_000);
  assert.equal(order.refundedAmount, 500_000);
  assertBalanced(service);
});

test('payouts lock funds, respect KYC limits and unlock on failure', async () => {
  const app = setup();
  const { service, partners } = app;
  const { order } = await paidTaskOrder(app, 1_000_000);
  service.completeOrder(order.id, 'u_anna');
  service.settle({ force: true });

  await assert.rejects(() => service.requestPayout('u_boris', { amount: 2_000_000, destination: 'card_4242' }), { code: 'insufficient_funds' });
  const failed = await service.requestPayout('u_boris', { amount: 500_000, destination: 'card_fail_0001' });
  assert.equal(service.balance('u_boris').balances[0].available, 402_000);
  await partners[AM].processPending();
  assert.equal(failed.status, 'failed');
  assert.equal(service.balance('u_boris').balances[0].available, 902_000);

  const ok = await service.requestPayout('u_boris', { amount: 902_000, destination: 'card_4242' });
  await partners[AM].processPending();
  assert.equal(ok.status, 'succeeded');
  assert.equal(service.balance('u_boris').balances[0].available, 0);
  assert.ok(ok.documentId);
  assertBalanced(service);
});

test('KYC payment limit is enforced per market', async () => {
  const { service } = setup();
  const order = service.createOrder({ product: 'tasks', externalRef: 'big', payerId: 'u_boris', payeeId: 'u_anna', amount: 30_000_000 });
  await assert.rejects(() => service.startPayment(order.id, { actorId: 'u_boris' }), { code: 'kyc_limit' });
});

test('cross-market orders are not supported at Pay Connect', () => {
  const { service } = setup();
  assert.throws(() => service.createOrder({ product: 'tasks', externalRef: 'x', payerId: 'u_dana', payeeId: 'u_boris', amount: 1000 }), { code: 'cross_market' });
});

test('fees are disclosed separately, including conversion', async () => {
  const app = setup();
  const { service, partners } = app;
  const order = service.createOrder({ product: 'food', externalRef: 'f1', payerId: 'u_anna', amount: 775_000 });
  const payment = await service.startPayment(order.id, { actorId: 'u_anna', currency: 'USD' });
  const q = payment.quote;
  assert.equal(q.payer.currency, 'USD');
  assert.equal(q.payer.converted, 2000); // 7750 AMD = 20.00 USD
  assert.equal(q.payer.fxCost, 30); // 1.5% markup
  assert.equal(q.payer.total, 2030);
  assert.equal(q.payee.acquiringFee, 13_950);
  assert.equal(q.payee.parriFee, 38_750);
  await partners[AM].completeCheckout(payment.partnerPaymentId, 'success');
  // Non-escrow product: released immediately to the business, pending settlement.
  assert.equal(order.status, 'completed');
  assert.equal(service.balance('m_fit').balances.find((b) => b.currency === 'AMD').expected.pendingSettlement, 0);
  assert.equal(service.balance('m_food').balances.find((b) => b.currency === 'AMD').expected.pendingSettlement, 775_000 - 13_950 - 38_750);
  // Bonuses are a separate unit and never part of money balances.
  assert.equal(service.balance('u_anna').bonuses.points, 7_750);
  assert.equal(service.ledger.balance('revenue:fx', 'USD'), 30);
  assertBalanced(service);
});

test('subscription: first payment saves the method, renewals are charged once per period', async () => {
  const app = setup();
  const { service, partners, clock } = app;
  const { subscription, payment } = await service.subscribe('u_anna', 'fit_pro');
  await partners[AM].completeCheckout(payment.partnerPaymentId, 'success');
  assert.equal(subscription.status, 'active');
  assert.ok(subscription.paymentMethodToken);

  clock.offsetMs += 31 * 86_400_000;
  await service.billSubscriptions();
  await service.billSubscriptions(); // job runs twice — same period, no second charge
  await partners[AM].processPending();
  assert.equal(subscription.period, 2);
  assert.equal(partners[AM].report().filter((r) => r.kind === 'pay' && r.status === 'succeeded').length, 2);

  partners[AM].declineMethod(subscription.paymentMethodToken);
  clock.offsetMs += 31 * 86_400_000;
  await service.billSubscriptions();
  await partners[AM].processPending();
  assert.equal(subscription.status, 'past_due');

  service.cancelSubscription('u_anna', subscription.id);
  assert.equal(subscription.cancelAtPeriodEnd, true);
  assertBalanced(service);
});

test('late success for a canceled order is captured and refunded automatically', async () => {
  const { service, partners } = setup();
  const order = service.createOrder({ product: 'tasks', externalRef: 'late', payerId: 'u_anna', payeeId: 'u_boris', amount: 200_000 });
  const payment = await service.startPayment(order.id, { actorId: 'u_anna' });
  service.cancelOrder(order.id, 'u_anna');
  assert.equal(payment.status, 'canceled');
  await partners[AM].completeCheckout(payment.partnerPaymentId, 'success');
  await partners[AM].processPending();
  const refund = [...service.store.refunds.values()].find((r) => r.orderId === order.id);
  assert.equal(refund.status, 'succeeded');
  assert.equal(order.status, 'canceled');
  assert.equal(service.ledger.balance(`escrow:${order.id}`, 'AMD'), 0);
  assertBalanced(service);
});

test('reconciliation matches partner report', async () => {
  const app = setup();
  const { service } = app;
  await paidTaskOrder(app);
  const r = service.reconciliation(AM);
  assert.equal(r.issues.length, 0);
  assert.equal(r.matched, 1);
});

test('platform capabilities are gated by level; network is never enabled', async () => {
  const { service } = createApp({ level: 'connect' });
  assert.throws(() => service.reconciliation(AM), { code: 'capability_unavailable' });
  assert.throws(() => service.businessSummary('m_food'), { code: 'capability_unavailable' });
  assert.throws(() => createApp({ level: 'network' }));
  assert.equal(service.capabilities().capabilities.ownSettlement, false);
  // Regulated products are unavailable without a permitted model.
  assert.equal(service.marketInfo('AM').regulated.lending.available, false);
});

test('antifraud blocks payment velocity at Pay Platform', async () => {
  const { service } = setup();
  for (let i = 0; i < 5; i++) {
    const o = service.createOrder({ product: 'tasks', externalRef: `v${i}`, payerId: 'u_anna', payeeId: 'u_boris', amount: 1000 });
    await service.startPayment(o.id, { actorId: 'u_anna' });
  }
  const o = service.createOrder({ product: 'tasks', externalRef: 'v-last', payerId: 'u_anna', payeeId: 'u_boris', amount: 1000 });
  await assert.rejects(() => service.startPayment(o.id, { actorId: 'u_anna' }), { code: 'antifraud_block' });
});

test('only order participants can act on it', async () => {
  const app = setup();
  const { order } = await paidTaskOrder(app);
  assert.throws(() => app.service.completeOrder(order.id, 'u_emil'), { code: 'forbidden' });
  await assert.rejects(() => app.service.requestRefund(order.id, { actorId: 'u_anna' }), { code: 'forbidden' });
});
