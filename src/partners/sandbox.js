import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// Sandbox model of an external bank / payment provider.
// It keeps its own state, deduplicates requests by idempotency key (as real
// providers do) and reports results via signed webhooks. Card data never reaches
// Parri: the payer enters it on the partner's hosted checkout page.
export class SandboxPartner {
  constructor({ id, secret, baseUrl = '', deliver, duplicateWebhooks = false, autoProcessMs = null }) {
    this.id = id;
    this.secret = secret;
    this.baseUrl = baseUrl;
    this.deliver = deliver;
    this.duplicateWebhooks = duplicateWebhooks;
    this.autoProcessMs = autoProcessMs;
    this.ops = new Map(); // partner operation id -> operation
    this.byKey = new Map(); // idempotency key -> partner operation id
    this.methods = new Map(); // saved payment method token -> { declined }
    this.outbox = [];
  }

  #create(kind, idempotencyKey, fields) {
    if (!idempotencyKey) throw new Error('partner requires an idempotency key');
    const known = this.byKey.get(idempotencyKey);
    if (known) return this.ops.get(known); // repeated request: no second charge
    const op = { id: `${this.id}_${kind}_${randomUUID().slice(0, 12)}`, kind, idempotencyKey, createdAt: new Date().toISOString(), ...fields };
    this.ops.set(op.id, op);
    this.byKey.set(idempotencyKey, op.id);
    this.#schedule();
    return op;
  }

  async createPayment({ idempotencyKey, amount, currency, description, paymentMethodToken, savePaymentMethod }) {
    const offSession = Boolean(paymentMethodToken);
    if (offSession && !this.methods.has(paymentMethodToken)) {
      throw Object.assign(new Error('unknown payment method'), { code: 'partner_unknown_method' });
    }
    const op = this.#create('pay', idempotencyKey, {
      amount, currency, description, paymentMethodToken, savePaymentMethod: Boolean(savePaymentMethod),
      status: offSession ? 'processing' : 'requires_action',
      refunded: 0,
    });
    return {
      partnerPaymentId: op.id,
      status: op.status,
      confirmationUrl: op.status === 'requires_action' ? `${this.baseUrl}/sandbox-partner/${this.id}/checkout/${op.id}` : null,
    };
  }

  async createRefund({ idempotencyKey, partnerPaymentId, amount }) {
    const payment = this.ops.get(partnerPaymentId);
    if (!payment || payment.status !== 'succeeded') throw Object.assign(new Error('payment not refundable'), { code: 'partner_rejected' });
    const op = this.#create('ref', idempotencyKey, { amount, currency: payment.currency, partnerPaymentId, status: 'processing' });
    return { partnerRefundId: op.id, status: op.status };
  }

  async createPayout({ idempotencyKey, amount, currency, destination }) {
    const op = this.#create('out', idempotencyKey, { amount, currency, destination, status: 'processing' });
    return { partnerPayoutId: op.id, status: op.status };
  }

  getOperation(id) {
    return this.ops.get(id);
  }

  // --- Sandbox controls -------------------------------------------------------

  // The payer finishes (or abandons) the hosted checkout.
  async completeCheckout(partnerPaymentId, outcome) {
    const op = this.ops.get(partnerPaymentId);
    if (!op || op.kind !== 'pay') throw new Error('unknown payment');
    if (op.status !== 'requires_action') return op;
    if (outcome === 'success') {
      op.status = 'succeeded';
      if (op.savePaymentMethod) {
        op.paymentMethodToken = `pm_${randomUUID().slice(0, 12)}`;
        this.methods.set(op.paymentMethodToken, { declined: false });
      }
      this.#emit('payment.succeeded', { partnerPaymentId: op.id, amount: op.amount, currency: op.currency, paymentMethodToken: op.paymentMethodToken ?? null });
    } else if (outcome === 'cancel') {
      op.status = 'canceled';
      this.#emit('payment.canceled', { partnerPaymentId: op.id });
    } else {
      op.status = 'failed';
      this.#emit('payment.failed', { partnerPaymentId: op.id, reason: 'card_declined' });
    }
    await this.flush();
    return op;
  }

  declineMethod(token) {
    const m = this.methods.get(token);
    if (m) m.declined = true;
  }

  // Processes asynchronous operations: off-session charges, refunds and payouts.
  async processPending() {
    for (const op of this.ops.values()) {
      if (op.status !== 'processing') continue;
      if (op.kind === 'pay') {
        const declined = this.methods.get(op.paymentMethodToken)?.declined;
        op.status = declined ? 'failed' : 'succeeded';
        this.#emit(declined ? 'payment.failed' : 'payment.succeeded', declined
          ? { partnerPaymentId: op.id, reason: 'card_declined' }
          : { partnerPaymentId: op.id, amount: op.amount, currency: op.currency, paymentMethodToken: op.paymentMethodToken });
      } else if (op.kind === 'ref') {
        const payment = this.ops.get(op.partnerPaymentId);
        op.status = 'succeeded';
        payment.refunded += op.amount;
        this.#emit('refund.succeeded', { partnerRefundId: op.id, partnerPaymentId: payment.id, amount: op.amount });
      } else if (op.kind === 'out') {
        const fail = String(op.destination).includes('fail');
        op.status = fail ? 'failed' : 'succeeded';
        this.#emit(fail ? 'payout.failed' : 'payout.succeeded', { partnerPayoutId: op.id, amount: op.amount, reason: fail ? 'destination_rejected' : undefined });
      }
    }
    await this.flush();
  }

  // Settlement report used for reconciliation.
  report() {
    return [...this.ops.values()].map((op) => ({
      partnerId: op.id, kind: op.kind, idempotencyKey: op.idempotencyKey, amount: op.amount, currency: op.currency, status: op.status,
    }));
  }

  // --- Webhooks ---------------------------------------------------------------

  #emit(type, data) {
    this.outbox.push({ id: `evt_${randomUUID().slice(0, 16)}`, type, createdAt: new Date().toISOString(), data });
  }

  async flush() {
    const pending = this.outbox.splice(0);
    for (const event of pending) {
      const body = JSON.stringify(event);
      const signature = sign(this.secret, body);
      try {
        await this.deliver(this.id, body, signature);
        // Real providers deliver "at least once"; the sandbox can mimic duplicates.
        if (this.duplicateWebhooks) await this.deliver(this.id, body, signature);
      } catch {
        this.outbox.push(event); // retried on the next flush
      }
    }
  }

  #schedule() {
    if (this.autoProcessMs == null) return;
    setTimeout(() => this.processPending().catch(() => {}), this.autoProcessMs).unref?.();
  }
}

export function sign(secret, body, timestamp = Math.floor(Date.now() / 1000)) {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

export function verifySignature(secret, body, header, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
