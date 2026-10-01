import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const AM = 'sandbox-am';

function assertBalanced(service) {
  for (const [currency, total] of Object.entries(service.ledger.trialBalance())) assert.equal(total, 0, `ledger not balanced in ${currency}`);
}

async function topUp(app, userId, amount) {
  const t = await app.service.requestTopup(userId, { amount });
  await app.partners[AM].completeCheckout(t.partnerPaymentId, 'success');
  return t;
}

async function linkKey(app, userId, model = 'signature') {
  const device = await app.keyFactory.manufacture(model);
  const { device: d, challenge } = await app.keys.beginLink(userId, device.readIdentity());
  const signature = await device.sign('payment', challenge.message, { presence: true });
  await app.keys.activate(userId, d.id, signature);
  return { device, id: d.id };
}

test('top-up credits the partner-held balance once and issues a receipt', async () => {
  const app = createApp({ level: 'platform' });
  const t = await topUp(app, 'u_anna', 5_000_000);
  assert.equal(t.status, 'succeeded');
  assert.equal(app.service.balance('u_anna').balances[0].available, 5_000_000);
  assert.ok(t.documentId);
  // Duplicate webhooks (sandbox delivers twice) did not double the balance.
  assert.equal([...app.service.store.ledgerTx.keys()].filter((k) => k.startsWith('topup:')).length, 1);
  assert.equal(app.service.reconciliation(AM).issues.length, 0);
  assertBalanced(app.service);
});

test('top-up respects the balance limit of the identification level', async () => {
  const app = createApp();
  await assert.rejects(() => app.service.requestTopup('u_boris', { amount: 40_000_000 }), { code: 'kyc_limit' });
});

test('top-up fee is disclosed and charged separately where the market has one', async () => {
  const app = createApp();
  const t = await app.service.requestTopup('u_emil', { amount: 10_000 });
  assert.equal(t.fee, 100);
  assert.equal(t.total, 10_100);
  await app.partners['sandbox-eu'].completeCheckout(t.partnerPaymentId, 'success');
  assert.equal(app.service.balance('u_emil').balances[0].available, 10_000);
  assert.equal(app.service.ledger.balance('revenue:topup_fee', 'EUR'), 100);
  assertBalanced(app.service);
});

test('paying from the balance skips acquiring and refunds go back to the balance', async () => {
  const app = createApp({ level: 'platform' });
  const { service } = app;
  await topUp(app, 'u_anna', 2_000_000);
  const order = service.createOrder({ product: 'tasks', externalRef: 'bal-1', payerId: 'u_anna', payeeId: 'u_boris', amount: 1_000_000 });
  const p = await service.startPayment(order.id, { actorId: 'u_anna', source: 'balance' });
  assert.equal(p.status, 'succeeded');
  assert.equal(p.quote.payee.acquiringFee, 0);
  assert.equal(order.reservation, 'held');
  assert.equal(service.balance('u_anna').balances[0].available, 1_000_000);

  await service.requestRefund(order.id, { amount: 400_000, actorId: 'u_boris' });
  assert.equal(service.balance('u_anna').balances[0].available, 1_400_000);
  service.completeOrder(order.id, 'u_anna');
  assert.equal(order.payeeNet, 600_000 - 48_000);
  assert.equal(service.reconciliation(AM).issues.length, 0);
  assertBalanced(service);

  const big = service.createOrder({ product: 'tasks', externalRef: 'bal-2', payerId: 'u_anna', payeeId: 'u_boris', amount: 5_000_000 });
  await assert.rejects(() => service.startPayment(big.id, { actorId: 'u_anna', source: 'balance' }), { code: 'insufficient_funds' });
  assert.equal(big.status, 'awaiting_payment');
});

test('linking requires a genuine device and the owner present', async () => {
  const app = createApp();
  const device = await app.keyFactory.manufacture('signature');
  const identity = device.readIdentity();

  await assert.rejects(() => app.keys.beginLink('u_anna', { ...identity, serial: 'PK-FAKE-000000' }), { code: 'attestation_failed' });

  const { device: d, challenge } = await app.keys.beginLink('u_anna', identity);
  await assert.rejects(() => device.sign('payment', challenge.message, { presence: false }), { code: 'presence_required' });
  // Wallet key cannot stand in for the payment key.
  const wrong = await device.sign('assets', challenge.message, { presence: true });
  await assert.rejects(() => app.keys.activate('u_anna', d.id, wrong), { code: 'bad_signature' });

  // The failed attempt consumed the challenge; start over.
  const again = await app.keys.beginLink('u_anna', identity);
  const sig = await device.sign('payment', again.challenge.message, { presence: true });
  const active = await app.keys.activate('u_anna', d.id, sig);
  assert.equal(active.status, 'active');
  assert.ok(!JSON.stringify(app.service.store.devices.get(d.id)).includes('"d"'), 'no private key material stored');

  await assert.rejects(() => app.keys.beginLink('u_boris', identity), { code: 'key_taken' });
});

test('payout with a linked key waits for physical confirmation', async () => {
  const app = createApp();
  const { service, keys, partners } = app;
  await topUp(app, 'u_anna', 3_000_000);
  const { device } = await linkKey(app, 'u_anna');

  const payout = await service.requestPayout('u_anna', { amount: 1_000_000, destination: 'card_4242' });
  assert.equal(payout.status, 'awaiting_confirmation');
  assert.equal(service.balance('u_anna').balances[0].restricted.payoutsInProgress, 1_000_000);
  assert.equal(partners[AM].report().filter((r) => r.kind === 'out').length, 0, 'nothing sent before confirmation');

  const [conf] = keys.pendingConfirmations('u_anna');
  assert.match(conf.text, /10\s000,00 AMD/);
  const forged = await device.sign('payment', conf.message.replace('****4242', '****9999'), { presence: true });
  await assert.rejects(() => keys.confirm('u_anna', conf.id, { signature: forged }), { code: 'bad_signature' });

  const sig = await device.sign('payment', conf.message, { presence: true });
  await keys.confirm('u_anna', conf.id, { signature: sig });
  assert.equal(payout.status, 'processing');
  await partners[AM].processPending();
  assert.equal(payout.status, 'succeeded');

  const second = await service.requestPayout('u_anna', { amount: 500_000, destination: 'card_4242' });
  await keys.confirm('u_anna', second.confirmation.id, { decline: true });
  assert.equal(second.status, 'failed');
  assert.equal(service.balance('u_anna').balances[0].available, 2_000_000);
  assertBalanced(service);
});

test('ring selection is signed by the device and cannot be replayed', async () => {
  const app = createApp();
  const { device, id } = await linkKey(app, 'u_anna');
  const view = app.keys.display('u_anna', id);
  assert.equal(view.screen.sourceId, 'balance');
  const wallet = view.sources.find((s) => s.id === 'assets');
  const sig = await device.sign('payment', wallet.selectMessage, { presence: true });
  const after = await app.keys.selectSource('u_anna', id, { sourceId: 'assets', counter: wallet.counter, signature: sig });
  assert.equal(after.screen.sourceId, 'assets');
  assert.equal(after.screen.address, after.device.walletAddress);
  await assert.rejects(() => app.keys.selectSource('u_anna', id, { sourceId: 'assets', counter: wallet.counter, signature: sig }), { code: 'stale_selection' });
});

test('wallet ownership is proven with the separate asset key', async () => {
  const app = createApp();
  const { device, id } = await linkKey(app, 'u_anna', 'core');
  const ch = app.keys.beginOwnershipCheck('u_anna', id);
  const bad = await device.sign('payment', ch.message, { presence: true });
  assert.equal((await app.keys.verifyOwnership('u_anna', id, bad)).valid, false);
  const ch2 = app.keys.beginOwnershipCheck('u_anna', id);
  const good = await device.sign('assets', ch2.message, { presence: true });
  assert.equal((await app.keys.verifyOwnership('u_anna', id, good)).valid, true);
});

test('blocking a lost key cancels pending confirmations and returns funds', async () => {
  const app = createApp();
  await topUp(app, 'u_anna', 1_000_000);
  const { id } = await linkKey(app, 'u_anna');
  const payout = await app.service.requestPayout('u_anna', { amount: 1_000_000, destination: 'card_4242' });
  app.keys.block('u_anna', id);
  await new Promise((r) => setImmediate(r));
  assert.equal(payout.status, 'failed');
  assert.equal(app.service.balance('u_anna').balances[0].available, 1_000_000);
  // Without an active key payouts go straight to the partner again.
  const next = await app.service.requestPayout('u_anna', { amount: 100_000, destination: 'card_4242' });
  assert.equal(next.status, 'processing');
});

test('Key Pay contactless needs an issuing partner on the market', () => {
  const app = createApp();
  const pay = app.keys.models('u_anna').find((m) => m.id === 'pay');
  assert.equal(pay.contactlessPayments.available, false);
});
