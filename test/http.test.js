import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../src/http/server.js';

let server;
let base;

before(async () => {
  ({ server } = createHttpServer({ level: 'connect' }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body), redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
};

test('brand service creates an order, payer pays through the partner page', async () => {
  const svc = { 'x-api-key': 'sk_sandbox_tasks' };
  const anna = { 'x-user-id': 'u_anna' };
  const order = await call('/api/service/orders', { method: 'POST', headers: svc, body: { externalRef: 'task-42', payerId: 'u_anna', payeeId: 'u_boris', amount: 250_000, description: 'Ремонт' } });
  assert.equal(order.status, 200);
  const repeat = await call('/api/service/orders', { method: 'POST', headers: svc, body: { externalRef: 'task-42', payerId: 'u_anna', payeeId: 'u_boris', amount: 250_000 } });
  assert.equal(repeat.data.id, order.data.id);

  const key = { ...anna, 'idempotency-key': 'k-1' };
  const p1 = await call(`/api/orders/${order.data.id}/payments`, { method: 'POST', headers: key, body: {} });
  const p2 = await call(`/api/orders/${order.data.id}/payments`, { method: 'POST', headers: key, body: {} });
  assert.equal(p1.data.id, p2.data.id);
  const conflict = await call(`/api/orders/${order.data.id}/payments`, { method: 'POST', headers: key, body: { currency: 'USD' } });
  assert.equal(conflict.status, 409);

  const page = await call(new URL(p1.data.confirmationUrl, base).pathname);
  assert.match(page.data, /Оплатить/);
  assert.ok(page.headers.get('content-security-policy'));
  const confirm = await fetch(base + new URL(p1.data.confirmationUrl, base).pathname, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'outcome=success', redirect: 'manual' });
  assert.equal(confirm.status, 303);

  const ops = await call('/api/me/operations', { headers: anna });
  assert.equal(ops.data[0].status, 'paid');
  assert.equal(ops.data[0].reservation, 'held');
  const doc = await call(`/api/documents/${ops.data[0].documents[0].id}?view=html`, { headers: anna });
  assert.match(doc.data.html, /Чек об оплате/);
  const foreign = await call(`/api/documents/${ops.data[0].documents[0].id}`, { headers: { 'x-user-id': 'u_dana' } });
  assert.equal(foreign.status, 404);
});

test('rejects unsigned webhooks, missing auth and Platform features at Connect level', async () => {
  const hook = await call('/api/webhooks/partners/sandbox-am', { method: 'POST', body: { id: 'evt', type: 'payment.succeeded', data: {} } });
  assert.equal(hook.status, 401);
  assert.equal((await call('/api/me/balance')).status, 401);
  const recon = await call('/api/business/reconciliation/sandbox-am', { headers: { 'x-api-key': 'sk_sandbox_tasks' } });
  assert.equal(recon.status, 403);
  assert.equal((await call('/api/network')).status, 403);
});
