import {
  MARKETS, PRODUCTS, LEVELS, CAPABILITIES, IMPLEMENTED_LEVELS, SEED_USERS, SEED_MERCHANTS, capabilityEnabled,
} from '../config.js';
import { Store } from '../store.js';
import { Ledger } from '../ledger.js';
import { Idempotency } from '../idempotency.js';
import { quote } from '../fees.js';
import { PayError, bps, assertAmount } from '../money.js';
import { evaluatePayment } from './antifraud.js';
import { reconcile } from './reconciliation.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Allowed payment state transitions. Anything else is rejected, so a late or
// repeated notification cannot move a payment backwards.
const PAYMENT_TRANSITIONS = {
  created: ['requires_action', 'processing', 'failed'],
  requires_action: ['succeeded', 'failed', 'canceled'],
  processing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  canceled: [],
};

export class PayService {
  constructor({ store = new Store(), level = 'connect', partners = {}, now = () => new Date() } = {}) {
    if (!LEVELS[level]) throw new Error(`Unknown level ${level}`);
    if (!IMPLEMENTED_LEVELS.includes(level)) {
      throw new Error(`${LEVELS[level].title} — отдельная долгосрочная программа и не включается в этом продукте`);
    }
    this.store = store;
    this.level = level;
    this.partners = partners;
    this.now = now;
    this.ledger = new Ledger(store);
    this.idempotency = new Idempotency(store);
    this.seed();
  }

  seed() {
    for (const u of SEED_USERS) if (!this.store.users.has(u.id)) this.store.users.set(u.id, { ...u });
    for (const m of SEED_MERCHANTS) if (!this.store.merchants.has(m.id)) this.store.merchants.set(m.id, { ...m });
  }

  // --- Capabilities -----------------------------------------------------------

  require(capability) {
    if (!capabilityEnabled(this.level, capability)) {
      const needed = LEVELS[CAPABILITIES[capability]];
      throw new PayError('capability_unavailable', `Возможность доступна на уровне ${needed.title}. Условие перехода: ${needed.transition}`, 403);
    }
  }

  capabilities() {
    return {
      level: this.level,
      levels: Object.entries(LEVELS).map(([id, l]) => ({ id, ...l, active: l.rank <= LEVELS[this.level].rank, implemented: IMPLEMENTED_LEVELS.includes(id) })),
      capabilities: Object.fromEntries(Object.keys(CAPABILITIES).map((c) => [c, capabilityEnabled(this.level, c)])),
    };
  }

  // --- Parties ----------------------------------------------------------------

  party(id) {
    const p = this.store.users.get(id) ?? this.store.merchants.get(id);
    if (!p) throw new PayError('unknown_party', `Участник ${id} не найден`, 404);
    return p;
  }

  isMerchant(id) {
    return this.store.merchants.has(id);
  }

  acct(partyId, bucket) {
    return `${this.isMerchant(partyId) ? 'merchant' : 'user'}:${partyId}:${bucket}`;
  }

  kycLimits(user) {
    return MARKETS[user.market].kyc[user.kycLevel];
  }

  marketInfo(market) {
    const m = MARKETS[market];
    if (!m) throw new PayError('unknown_market', `Рынок ${market} не поддерживается`, 404);
    return {
      id: market,
      name: m.name,
      settlementCurrency: m.settlementCurrency,
      paymentCurrencies: m.paymentCurrencies,
      partner: m.partner,
      settlementDelayDays: m.settlementDelayDays,
      kyc: m.kyc,
      regulated: Object.fromEntries(Object.entries(m.regulated).map(([k, v]) => [k, v
        ? { available: true }
        : { available: false, note: 'Добавляется только через соответствующую разрешённую модель (лицензия или лицензированный партнёр)' }])),
    };
  }

  // --- Orders -----------------------------------------------------------------

  createOrder({ product, externalRef, payerId, payeeId, amount, description, subscriptionId = null }) {
    const p = PRODUCTS[product];
    if (!p) throw new PayError('unknown_product', `Продукт ${product} не подключён к Pay`);
    if (!externalRef) throw new PayError('external_ref_required', 'Нужен идентификатор заказа в продукте (externalRef)');
    assertAmount(amount);

    // An order is unique per product + externalRef: a repeated request returns the same order.
    const uniq = `${product}:${externalRef}`;
    for (const o of this.store.orders.values()) if (o.uniq === uniq) return o;

    const payer = this.store.users.get(payerId);
    if (!payer) throw new PayError('unknown_payer', 'Плательщик не найден', 404);
    const payee = p.merchant ? this.party(p.merchant) : this.store.users.get(payeeId);
    if (!payee) throw new PayError('unknown_payee', 'Получатель не найден', 404);
    if (payee.id === payer.id) throw new PayError('self_payment', 'Нельзя оплатить заказ самому себе');
    if (!this.isMerchant(payee.id) && payee.market !== payer.market) {
      throw new PayError('cross_market', 'Плательщик и получатель на разных рынках: такие расчёты не поддерживаются на уровне Pay Connect');
    }
    const market = payer.market;
    const q = quote({ market, product, amount });
    const order = {
      id: Store.id('ord'),
      uniq,
      product,
      externalRef,
      market,
      payerId: payer.id,
      payeeId: payee.id,
      amount,
      currency: q.settlementCurrency,
      description: description ?? PRODUCTS[product].title,
      status: 'awaiting_payment',
      reservation: 'none',
      escrow: p.escrow,
      subscriptionId,
      paymentIds: [],
      activePaymentId: null,
      capturedPaymentId: null,
      refundedAmount: 0,
      pendingRefundAmount: 0,
      parriFeeCollected: 0,
      parriFeeReturned: 0,
      payeeNet: 0,
      settled: false,
      settleAfter: null,
      documentIds: [],
      createdAt: this.now().toISOString(),
      history: [],
    };
    this.#orderEvent(order, 'created', 'Заказ создан');
    this.store.orders.set(order.id, order);
    return order;
  }

  getOrder(id) {
    const o = this.store.orders.get(id);
    if (!o) throw new PayError('order_not_found', 'Заказ не найден', 404);
    return o;
  }

  cancelOrder(orderId, actorId) {
    const order = this.getOrder(orderId);
    this.#assertOrderActor(order, actorId, ['payer', 'service']);
    if (order.status !== 'awaiting_payment') throw new PayError('invalid_state', 'Отменить можно только неоплаченный заказ', 409);
    if (order.activePaymentId) {
      const payment = this.store.payments.get(order.activePaymentId);
      if (payment.status === 'processing') throw new PayError('payment_in_progress', 'Платёж уже обрабатывается партнёром', 409);
      if (['created', 'requires_action'].includes(payment.status)) this.#transition(payment, 'canceled', 'Заказ отменён');
      order.activePaymentId = null;
    }
    order.status = 'canceled';
    this.#orderEvent(order, 'canceled', 'Заказ отменён');
    return order;
  }

  // --- Payments ---------------------------------------------------------------

  async startPayment(orderId, { actorId, currency, savePaymentMethod = false, paymentMethodToken = null } = {}) {
    this.require('payments');
    const order = this.getOrder(orderId);
    if (actorId) this.#assertOrderActor(order, actorId, ['payer', 'service']);
    if (order.status !== 'awaiting_payment') {
      throw new PayError('order_not_payable', order.status === 'canceled' ? 'Заказ отменён' : 'Заказ уже оплачен', 409);
    }
    // One active payment per order: a double click returns the same payment instead of a second charge.
    if (order.activePaymentId) {
      const active = this.store.payments.get(order.activePaymentId);
      if (['created', 'requires_action', 'processing'].includes(active.status)) return active;
    }

    const payer = this.store.users.get(order.payerId);
    const limits = this.kycLimits(payer);
    if (order.amount > limits.maxPayment) {
      throw new PayError('kyc_limit', `Сумма превышает лимит платежа для уровня идентификации «${limits.title}». Повысить лимит: ${MARKETS[payer.market].kyc.verified.procedure}`, 422);
    }
    let risk = null;
    if (capabilityEnabled(this.level, 'antifraud')) {
      risk = evaluatePayment({ store: this.store, payerId: payer.id, amount: order.amount, kycLimits: limits, now: this.now() });
      if (risk.decision === 'block') throw new PayError('antifraud_block', `Платёж отклонён антифродом: ${risk.reasons.join('; ')}`, 422, risk);
    }

    const q = quote({ market: order.market, product: order.product, amount: order.amount, payerCurrency: currency });
    const payment = {
      id: Store.id('pay'),
      orderId: order.id,
      payerId: payer.id,
      partner: q.partner,
      quote: q,
      status: 'created',
      partnerPaymentId: null,
      confirmationUrl: null,
      offSession: Boolean(paymentMethodToken),
      savePaymentMethod,
      subscriptionId: order.subscriptionId,
      risk,
      failureReason: null,
      createdAt: this.now().toISOString(),
      history: [{ status: 'created', at: this.now().toISOString() }],
    };
    this.store.payments.set(payment.id, payment);
    order.paymentIds.push(payment.id);
    order.activePaymentId = payment.id;

    try {
      // The payment id is the idempotency key at the partner: a retried call cannot charge twice.
      const res = await this.#partner(payment.partner).createPayment({
        idempotencyKey: payment.id,
        amount: q.payer.total,
        currency: q.payer.currency,
        description: order.description,
        paymentMethodToken,
        savePaymentMethod,
      });
      payment.partnerPaymentId = res.partnerPaymentId;
      payment.confirmationUrl = res.confirmationUrl;
      if (payment.status === 'created') this.#transition(payment, res.status);
    } catch (err) {
      if (payment.status === 'created') {
        payment.failureReason = 'partner_unavailable';
        this.#transition(payment, 'failed', 'Партнёр не принял платёж');
        order.activePaymentId = null;
      }
      throw new PayError('partner_error', 'Платёжный партнёр временно недоступен, попробуйте ещё раз', 502);
    }
    return payment;
  }

  getPayment(id) {
    const p = this.store.payments.get(id);
    if (!p) throw new PayError('payment_not_found', 'Платёж не найден', 404);
    return p;
  }

  // --- Partner notifications --------------------------------------------------

  async handlePartnerEvent(partnerId, event) {
    if (!event?.id || !event?.type) throw new PayError('invalid_event', 'Некорректное событие партнёра');
    const key = `${partnerId}:${event.id}`;
    if (this.store.processedEvents.has(key)) return { result: 'duplicate' };
    this.store.processedEvents.set(key, { type: event.type, state: 'processing', at: this.now().toISOString() });
    try {
      const result = await this.#dispatch(partnerId, event);
      this.store.processedEvents.set(key, { type: event.type, state: 'done', result, at: this.now().toISOString() });
      return { result };
    } catch (err) {
      // Not marked as processed: the partner will redeliver it.
      this.store.processedEvents.delete(key);
      throw err;
    }
  }

  async #dispatch(partnerId, { type, data }) {
    switch (type) {
      case 'payment.succeeded': return this.#onPaymentSucceeded(this.#paymentByPartnerId(partnerId, data.partnerPaymentId), data);
      case 'payment.failed':
      case 'payment.canceled': return this.#onPaymentFailed(this.#paymentByPartnerId(partnerId, data.partnerPaymentId), type, data);
      case 'refund.succeeded': return this.#onRefundResult(this.#byPartnerId('refunds', partnerId, data.partnerRefundId), true);
      case 'refund.failed': return this.#onRefundResult(this.#byPartnerId('refunds', partnerId, data.partnerRefundId), false);
      case 'payout.succeeded': return this.#onPayoutResult(this.#byPartnerId('payouts', partnerId, data.partnerPayoutId), true);
      case 'payout.failed': return this.#onPayoutResult(this.#byPartnerId('payouts', partnerId, data.partnerPayoutId), false, data.reason);
      default: return 'ignored';
    }
  }

  async #onPaymentSucceeded(payment, data) {
    const order = this.getOrder(payment.orderId);
    if (payment.status === 'succeeded') return 'already_succeeded';
    if (Number(data.amount) !== payment.quote.payer.total) {
      throw new PayError('amount_mismatch', 'Сумма в уведомлении партнёра не совпадает с платёжным поручением', 409);
    }
    const late = payment.status === 'canceled' || payment.status === 'failed';
    if (late) {
      // Money was taken after we considered the payment closed: record it and return it.
      payment.history.push({ status: 'succeeded', at: this.now().toISOString(), note: 'Позднее подтверждение партнёра' });
      payment.status = 'succeeded';
    } else {
      this.#transition(payment, 'succeeded');
    }
    if (data.paymentMethodToken) payment.paymentMethodToken = data.paymentMethodToken;

    this.#postCapture(order, payment);
    if (order.activePaymentId === payment.id) order.activePaymentId = null;

    if (late || order.status !== 'awaiting_payment') {
      // Order was canceled or already paid by another payment: the money is recorded
      // and returned in full, without touching the order's own settlement.
      this.#orderEvent(order, 'excess_payment', 'Получен лишний платёж, оформлен автоматический возврат');
      await this.#createRefund(order, order.amount, 'Автоматический возврат лишнего платежа', payment, true);
      return 'captured_and_refunded';
    }

    order.capturedPaymentId = payment.id;
    order.status = 'paid';
    order.reservation = order.escrow ? 'held' : 'none';
    this.#orderEvent(order, 'paid', order.escrow ? 'Оплачено, средства зарезервированы до завершения заказа' : 'Оплачено');
    this.#issueDocument('receipt', order, payment);
    this.#accrueBonus(order);
    this.#notify(order.payerId, `Оплата прошла: ${order.description}`, order.id);
    this.#notify(order.payeeId, order.escrow ? `Заказ оплачен, средства в резерве: ${order.description}` : `Получена оплата: ${order.description}`, order.id);

    // Next allowed step.
    if (!order.escrow) this.#release(order);
    if (order.subscriptionId) this.#onSubscriptionPaid(order, payment);
    return 'captured';
  }

  #onPaymentFailed(payment, type, data) {
    if (!PAYMENT_TRANSITIONS[payment.status].length) return 'ignored_terminal';
    const order = this.getOrder(payment.orderId);
    payment.failureReason = data.reason ?? (type === 'payment.canceled' ? 'canceled_by_payer' : 'declined');
    this.#transition(payment, type === 'payment.canceled' ? 'canceled' : 'failed');
    if (order.activePaymentId === payment.id) order.activePaymentId = null;
    this.#notify(order.payerId, `Платёж не прошёл: ${order.description}. Можно попробовать снова.`, order.id);
    if (order.subscriptionId) this.#onSubscriptionFailed(order);
    return 'failed';
  }

  #postCapture(order, payment) {
    const q = payment.quote;
    const ext = `external:${payment.partner}`;
    this.ledger.post({
      operationId: `capture:${payment.id}`,
      description: `Оплата заказа ${order.id}`,
      currency: order.currency,
      transfers: [
        { from: ext, to: `escrow:${order.id}`, amount: order.amount },
        // The partner withholds its acquiring fee; it is recovered from the payee on release.
        { from: 'expense:acquiring', to: ext, amount: q.payee.acquiringFee },
      ],
      meta: { orderId: order.id, paymentId: payment.id },
    });
    if (q.payer.fxCost > 0) {
      this.ledger.post({
        operationId: `fx:${payment.id}`,
        description: `Конвертация по заказу ${order.id}`,
        currency: q.payer.currency,
        transfers: [{ from: ext, to: 'revenue:fx', amount: q.payer.fxCost }],
        meta: { orderId: order.id, paymentId: payment.id },
      });
    }
  }

  // --- Reservation release (order completion) and settlement -------------------

  completeOrder(orderId, actorId) {
    const order = this.getOrder(orderId);
    this.#assertOrderActor(order, actorId, ['payer', 'service']);
    if (order.status !== 'paid' || !['held', 'partially_returned'].includes(order.reservation)) {
      throw new PayError('invalid_state', 'Завершить можно только оплаченный заказ с зарезервированными средствами', 409);
    }
    this.#release(order);
    return order;
  }

  #release(order) {
    const p = PRODUCTS[order.product];
    const payment = this.store.payments.get(order.capturedPaymentId);
    const remaining = this.ledger.balance(`escrow:${order.id}`, order.currency);
    if (remaining <= 0) throw new PayError('nothing_to_release', 'Нет средств в резерве', 409);
    const parriFee = Math.min(bps(remaining, p.parriFeeBps), remaining);
    const acquiring = Math.min(payment.quote.payee.acquiringFee, remaining - parriFee);
    const net = remaining - parriFee - acquiring;
    const transfers = [
      { from: `escrow:${order.id}`, to: this.acct(order.payeeId, 'pending'), amount: net },
      { from: `escrow:${order.id}`, to: 'revenue:parri_fee', amount: parriFee },
      { from: `escrow:${order.id}`, to: 'expense:acquiring', amount: acquiring },
    ].filter((t) => t.amount > 0);
    this.ledger.post({ operationId: `release:${order.id}`, description: `Расчёт по заказу ${order.id}`, currency: order.currency, transfers, meta: { orderId: order.id } });
    order.parriFeeCollected = parriFee;
    order.acquiringFeeCharged = acquiring;
    order.payeeNet = net;
    order.status = 'completed';
    if (order.escrow) order.reservation = 'released';
    order.settleAfter = new Date(this.now().getTime() + MARKETS[order.market].settlementDelayDays * DAY_MS).toISOString();
    this.#orderEvent(order, 'completed', order.escrow ? 'Заказ завершён, резерв снят, выплата исполнителю ожидает расчёта' : 'Поступление ожидает расчёта партнёра');
    this.#issueDocument(order.escrow ? 'act' : 'income_statement', order, payment);
    this.#notify(order.payeeId, `Ожидаемая выплата по заказу «${order.description}»`, order.id);
  }

  // Partner settlement: expected funds become available for payout.
  settle({ force = false } = {}) {
    const now = this.now().getTime();
    const settled = [];
    for (const order of this.store.orders.values()) {
      if (order.status !== 'completed' || order.settled || !order.payeeNet) continue;
      if (!force && Date.parse(order.settleAfter) > now) continue;
      const pending = this.acct(order.payeeId, 'pending');
      const amount = Math.min(order.payeeNet, this.ledger.balance(pending, order.currency));
      if (amount > 0) {
        this.ledger.post({
          operationId: `settle:${order.id}`,
          description: `Расчёт партнёра по заказу ${order.id}`,
          currency: order.currency,
          transfers: [{ from: pending, to: this.acct(order.payeeId, 'available'), amount }],
          meta: { orderId: order.id },
        });
      }
      order.settled = true;
      this.#orderEvent(order, 'settled', 'Средства доступны к выплате');
      this.#notify(order.payeeId, 'Средства доступны к выплате', order.id);
      settled.push(order.id);
    }
    return settled;
  }

  // --- Refunds ----------------------------------------------------------------

  async requestRefund(orderId, { amount, reason = '', actorId }) {
    this.require('refunds');
    const order = this.getOrder(orderId);
    if (actorId) this.#assertOrderActor(order, actorId, ['payee', 'service']);
    if (!['paid', 'completed'].includes(order.status) || !order.capturedPaymentId) {
      throw new PayError('invalid_state', 'Возврат возможен только по оплаченному заказу', 409);
    }
    const refundable = order.amount - order.refundedAmount - order.pendingRefundAmount;
    const value = amount ?? refundable;
    assertAmount(value);
    if (value > refundable) throw new PayError('refund_exceeds', `Можно вернуть не больше ${refundable}`, 409);
    return this.#createRefund(order, value, reason);
  }

  async #createRefund(order, amount, reason, paymentOverride = null, excess = false) {
    const payment = paymentOverride ?? this.store.payments.get(order.capturedPaymentId);
    const refund = {
      excess,
      id: Store.id('ref'),
      orderId: order.id,
      paymentId: payment.id,
      partner: payment.partner,
      amount,
      currency: order.currency,
      payerAmount: Math.round((payment.quote.payer.converted * amount) / order.amount),
      payerCurrency: payment.quote.payer.currency,
      reason,
      status: 'processing',
      locks: [],
      createdAt: this.now().toISOString(),
    };
    const escrow = `escrow:${order.id}`;
    const transfers = [];
    if (this.ledger.balance(escrow, order.currency) >= amount) {
      transfers.push({ from: escrow, to: `refund:${refund.id}`, amount });
    } else {
      // Released order: Parri returns its proportional commission, the payee returns the rest.
      const parriShare = Math.min(bps(amount, PRODUCTS[order.product].parriFeeBps), order.parriFeeCollected - order.parriFeeReturned);
      const pending = this.acct(order.payeeId, 'pending');
      const available = this.acct(order.payeeId, 'available');
      const fromPending = Math.min(this.ledger.balance(pending, order.currency) + parriShare, amount);
      const fromAvailable = amount - fromPending;
      if (fromAvailable > this.ledger.balance(available, order.currency)) {
        throw new PayError('insufficient_funds', 'У получателя недостаточно средств для возврата — требуется ручная обработка поддержкой', 409);
      }
      if (parriShare > 0) transfers.push({ from: 'revenue:parri_fee', to: pending, amount: parriShare });
      if (fromPending > 0) transfers.push({ from: pending, to: `refund:${refund.id}`, amount: fromPending });
      if (fromAvailable > 0) transfers.push({ from: available, to: `refund:${refund.id}`, amount: fromAvailable });
      refund.parriShare = parriShare;
    }
    this.ledger.post({ operationId: `refund_lock:${refund.id}`, description: `Резерв под возврат ${refund.id}`, currency: order.currency, transfers, meta: { orderId: order.id, refundId: refund.id } });
    refund.locks = transfers;
    this.store.refunds.set(refund.id, refund);
    if (!excess) order.pendingRefundAmount += amount;

    try {
      const res = await this.#partner(refund.partner).createRefund({
        idempotencyKey: refund.id,
        partnerPaymentId: payment.partnerPaymentId,
        amount: refund.payerAmount,
      });
      refund.partnerRefundId = res.partnerRefundId;
    } catch {
      this.#onRefundResult(refund, false);
      throw new PayError('partner_error', 'Партнёр не принял возврат, средства возвращены в резерв', 502);
    }
    this.#notify(order.payerId, `Оформлен возврат по заказу «${order.description}»`, order.id);
    return refund;
  }

  #onRefundResult(refund, ok) {
    if (refund.status !== 'processing') return 'ignored_terminal';
    const order = this.getOrder(refund.orderId);
    if (!refund.excess) order.pendingRefundAmount -= refund.amount;
    if (ok) {
      this.ledger.post({
        operationId: `refund_done:${refund.id}`,
        description: `Возврат ${refund.id}`,
        currency: refund.currency,
        transfers: [{ from: `refund:${refund.id}`, to: `external:${refund.partner}`, amount: refund.amount }],
        meta: { orderId: order.id, refundId: refund.id },
      });
      refund.status = 'succeeded';
      if (refund.excess) {
        this.#notify(order.payerId, `Лишний платёж по заказу «${order.description}» возвращён`, order.id);
        return 'refunded';
      }
      order.refundedAmount += refund.amount;
      if (refund.parriShare) order.parriFeeReturned += refund.parriShare;
      const full = order.refundedAmount >= order.amount;
      if (full) order.status = 'refunded';
      if (order.reservation === 'held' || order.reservation === 'partially_returned') {
        order.reservation = this.ledger.balance(`escrow:${order.id}`, order.currency) === 0 ? 'returned' : 'partially_returned';
        if (order.reservation === 'returned' && order.status === 'paid') order.status = 'refunded';
      }
      this.#clawBackBonus(order, refund);
      this.#orderEvent(order, 'refunded', `Возврат ${refund.amount} ${refund.currency} выполнен`);
      this.#issueDocument('refund_receipt', order, this.store.payments.get(refund.paymentId), { refund });
      this.#notify(order.payerId, `Деньги возвращены по заказу «${order.description}»`, order.id);
    } else {
      // Return locked funds where they came from (commission share goes back to revenue).
      const transfers = refund.locks.map((t) => (t.from === 'revenue:parri_fee'
        ? null
        : { from: `refund:${refund.id}`, to: t.from, amount: t.amount })).filter(Boolean);
      if (refund.parriShare) {
        const pendingLeg = transfers.find((t) => t.to === this.acct(order.payeeId, 'pending'));
        const back = Math.min(refund.parriShare, pendingLeg?.amount ?? 0);
        if (pendingLeg) pendingLeg.amount -= back;
        transfers.push({ from: `refund:${refund.id}`, to: 'revenue:parri_fee', amount: back });
      }
      this.ledger.post({
        operationId: `refund_unlock:${refund.id}`,
        description: `Отмена возврата ${refund.id}`,
        currency: refund.currency,
        transfers: transfers.filter((t) => t.amount > 0),
        meta: { orderId: order.id, refundId: refund.id },
      });
      refund.status = 'failed';
      this.#notify(order.payeeId, `Возврат по заказу «${order.description}» не выполнен партнёром`, order.id);
    }
    return ok ? 'refunded' : 'refund_failed';
  }

  // --- Payouts ----------------------------------------------------------------

  async requestPayout(partyId, { amount, destination }) {
    this.require('payouts');
    const party = this.party(partyId);
    assertAmount(amount);
    if (!destination) throw new PayError('destination_required', 'Укажите реквизиты для выплаты');
    const market = this.isMerchant(partyId) ? null : party.market;
    const currency = market ? MARKETS[market].settlementCurrency : this.#merchantCurrency(destination);
    const partner = market ? MARKETS[market].partner : MARKETS[Object.keys(MARKETS).find((k) => MARKETS[k].settlementCurrency === currency)].partner;

    if (!this.isMerchant(partyId)) {
      const limits = this.kycLimits(party);
      const used = this.#payoutsThisMonth(partyId);
      if (used + amount > limits.monthlyPayout) {
        throw new PayError('kyc_limit', `Превышен месячный лимит выплат (${limits.monthlyPayout - used} осталось). Для повышения: ${MARKETS[market].kyc.verified.procedure}`, 422);
      }
    }
    const payout = {
      id: Store.id('out'),
      partyId,
      amount,
      currency,
      partner,
      destination: maskDestination(destination),
      status: 'processing',
      createdAt: this.now().toISOString(),
    };
    // Lock first: the same funds cannot be paid out twice.
    this.ledger.post({
      operationId: `payout_lock:${payout.id}`,
      description: `Выплата ${payout.id}`,
      currency,
      transfers: [{ from: this.acct(partyId, 'available'), to: `payout:${payout.id}`, amount }],
      meta: { payoutId: payout.id },
    });
    this.store.payouts.set(payout.id, payout);
    try {
      const res = await this.#partner(partner).createPayout({ idempotencyKey: payout.id, amount, currency, destination });
      payout.partnerPayoutId = res.partnerPayoutId;
    } catch {
      this.#onPayoutResult(payout, false, 'partner_unavailable');
      throw new PayError('partner_error', 'Партнёр не принял выплату, средства возвращены на баланс', 502);
    }
    return payout;
  }

  #merchantCurrency(destination) {
    const m = /:(AMD|KZT|EUR)$/.exec(destination);
    if (!m) throw new PayError('currency_required', 'Для выплаты бизнесу укажите валюту в реквизитах, например acc_123:AMD');
    return m[1];
  }

  #payoutsThisMonth(partyId) {
    const now = this.now();
    let sum = 0;
    for (const p of this.store.payouts.values()) {
      const d = new Date(p.createdAt);
      if (p.partyId === partyId && p.status !== 'failed' && d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()) sum += p.amount;
    }
    return sum;
  }

  #onPayoutResult(payout, ok, reason) {
    if (payout.status !== 'processing') return 'ignored_terminal';
    if (ok) {
      this.ledger.post({ operationId: `payout_done:${payout.id}`, description: `Выплата ${payout.id}`, currency: payout.currency, transfers: [{ from: `payout:${payout.id}`, to: `external:${payout.partner}`, amount: payout.amount }] });
      payout.status = 'succeeded';
      payout.documentId = this.#issueDocument('payout_statement', null, null, { payout }).id;
      this.#notify(payout.partyId, 'Выплата отправлена', payout.id);
    } else {
      this.ledger.post({ operationId: `payout_unlock:${payout.id}`, description: `Отмена выплаты ${payout.id}`, currency: payout.currency, transfers: [{ from: `payout:${payout.id}`, to: this.acct(payout.partyId, 'available'), amount: payout.amount }] });
      payout.status = 'failed';
      payout.failureReason = reason ?? 'rejected';
      this.#notify(payout.partyId, 'Выплата не прошла, средства вернулись на баланс', payout.id);
    }
    return ok ? 'paid_out' : 'payout_failed';
  }

  // --- Subscriptions ----------------------------------------------------------

  async subscribe(userId, planId, { currency } = {}) {
    this.require('subscriptions');
    const user = this.party(userId);
    const [product, plan] = Object.entries(PRODUCTS).map(([k, p]) => [k, p.plans?.[planId]]).find(([, pl]) => pl) ?? [];
    if (!plan) throw new PayError('unknown_plan', 'Тариф не найден', 404);
    const price = plan.price[user.market];
    if (!price) throw new PayError('plan_unavailable', 'Тариф недоступен на вашем рынке');
    for (const s of this.store.subscriptions.values()) {
      if (s.userId === userId && s.planId === planId && ['active', 'incomplete', 'past_due'].includes(s.status)) {
        if (s.status === 'incomplete') {
          const order = this.getOrder(s.currentOrderId);
          const payment = await this.startPayment(order.id, { currency, savePaymentMethod: true });
          return { subscription: s, payment };
        }
        throw new PayError('already_subscribed', 'Подписка уже оформлена', 409);
      }
    }
    const sub = {
      id: Store.id('sub'), userId, planId, product, title: plan.title, price, currency: MARKETS[user.market].settlementCurrency,
      status: 'incomplete', period: 1, currentPeriodEnd: null, cancelAtPeriodEnd: false, paymentMethodToken: null, payerCurrency: currency ?? null,
      currentOrderId: null, createdAt: this.now().toISOString(),
    };
    this.store.subscriptions.set(sub.id, sub);
    const order = this.createOrder({ product, externalRef: `sub:${sub.id}:1`, payerId: userId, amount: price, description: `${plan.title} (период 1)`, subscriptionId: sub.id });
    sub.currentOrderId = order.id;
    const payment = await this.startPayment(order.id, { currency, savePaymentMethod: true });
    return { subscription: sub, payment };
  }

  #onSubscriptionPaid(order, payment) {
    const sub = this.store.subscriptions.get(order.subscriptionId);
    if (payment.paymentMethodToken) sub.paymentMethodToken = payment.paymentMethodToken;
    const plan = PRODUCTS[sub.product].plans[sub.planId];
    const start = sub.currentPeriodEnd && Date.parse(sub.currentPeriodEnd) > this.now().getTime() ? Date.parse(sub.currentPeriodEnd) : this.now().getTime();
    sub.currentPeriodEnd = new Date(start + plan.periodDays * DAY_MS).toISOString();
    sub.status = 'active';
    this.#notify(sub.userId, `Подписка «${sub.title}» активна до ${sub.currentPeriodEnd.slice(0, 10)}`, sub.id);
  }

  #onSubscriptionFailed(order) {
    const sub = this.store.subscriptions.get(order.subscriptionId);
    if (sub.status === 'active') {
      sub.status = 'past_due';
      this.#notify(sub.userId, `Не удалось продлить подписку «${sub.title}». Обновите способ оплаты.`, sub.id);
    }
  }

  cancelSubscription(userId, subId) {
    const sub = this.store.subscriptions.get(subId);
    if (!sub || sub.userId !== userId) throw new PayError('subscription_not_found', 'Подписка не найдена', 404);
    if (sub.status === 'incomplete') sub.status = 'canceled';
    else sub.cancelAtPeriodEnd = true;
    return sub;
  }

  // Recurring billing job. Each period has its own order (externalRef sub:<id>:<period>),
  // so running the job twice never charges the same period twice.
  async billSubscriptions() {
    const now = this.now().getTime();
    const results = [];
    for (const sub of this.store.subscriptions.values()) {
      if (!['active', 'past_due'].includes(sub.status) || Date.parse(sub.currentPeriodEnd) > now) continue;
      if (sub.cancelAtPeriodEnd) {
        sub.status = 'canceled';
        results.push({ id: sub.id, result: 'canceled' });
        continue;
      }
      // While the current period's order is unpaid (processing or declined), retry it instead of opening a new period.
      const current = this.store.orders.get(sub.currentOrderId);
      const next = current?.status === 'awaiting_payment' ? sub.period : sub.period + 1;
      const order = this.createOrder({ product: sub.product, externalRef: `sub:${sub.id}:${next}`, payerId: sub.userId, amount: sub.price, description: `${sub.title} (период ${next})`, subscriptionId: sub.id });
      sub.period = next;
      sub.currentOrderId = order.id;
      if (order.status !== 'awaiting_payment') continue;
      try {
        await this.startPayment(order.id, { currency: sub.payerCurrency ?? undefined, paymentMethodToken: sub.paymentMethodToken });
        results.push({ id: sub.id, result: 'charging', orderId: order.id });
      } catch (err) {
        results.push({ id: sub.id, result: 'error', error: err.message });
      }
    }
    return results;
  }

  // --- Balance, history, documents, notifications -----------------------------

  balance(partyId) {
    const party = this.party(partyId);
    const merchant = this.isMerchant(partyId);
    const currencies = merchant ? [...new Set(Object.values(MARKETS).map((m) => m.settlementCurrency))] : [MARKETS[party.market].settlementCurrency];
    const perCurrency = currencies.map((currency) => {
      let reservedForMe = 0;
      let reservedByMe = 0;
      for (const o of this.store.orders.values()) {
        if (o.currency !== currency || o.reservation !== 'held' && o.reservation !== 'partially_returned') continue;
        const held = this.ledger.balance(`escrow:${o.id}`, currency);
        if (o.payeeId === partyId && o.status === 'paid') reservedForMe += held;
        if (o.payerId === partyId && o.status === 'paid') reservedByMe += held;
      }
      let payoutsInProgress = 0;
      for (const p of this.store.payouts.values()) if (p.partyId === partyId && p.status === 'processing' && p.currency === currency) payoutsInProgress += p.amount;
      return {
        currency,
        // Real money that can be paid out right now.
        available: this.ledger.balance(this.acct(partyId, 'available'), currency),
        // Expected incoming money, not yet available.
        expected: {
          pendingSettlement: this.ledger.balance(this.acct(partyId, 'pending'), currency),
          reservedForMyOrders: reservedForMe,
          note: 'Резерв по заказам поступит после их завершения за вычетом комиссий',
        },
        // Money that is mine but temporarily restricted.
        restricted: {
          reservedInMyPurchases: reservedByMe,
          payoutsInProgress,
        },
      };
    });
    const limits = merchant ? null : (() => {
      const l = this.kycLimits(party);
      const used = this.#payoutsThisMonth(partyId);
      return { kycLevel: party.kycLevel, title: l.title, procedure: l.procedure, maxPayment: l.maxPayment, monthlyPayout: l.monthlyPayout, payoutUsedThisMonth: used, payoutRemaining: Math.max(0, l.monthlyPayout - used), currency: currencies[0] };
    })();
    return {
      partyId,
      balances: perCurrency,
      limits,
      bonuses: {
        points: this.ledger.balance(`bonus:${partyId}`, 'BONUS'),
        note: 'Бонусы — не денежные средства: не выводятся и не суммируются с балансом',
      },
    };
  }

  operations(partyId) {
    this.party(partyId);
    const out = [];
    for (const o of this.store.orders.values()) {
      const payment = o.capturedPaymentId ? this.store.payments.get(o.capturedPaymentId) : this.store.payments.get(o.paymentIds.at(-1));
      if (o.payerId === partyId) {
        out.push({
          kind: 'payment', at: o.createdAt, orderId: o.id, product: o.product, description: o.description,
          amount: -(payment?.quote.payer.total ?? o.amount), currency: payment?.quote.payer.currency ?? o.currency,
          status: o.status, paymentStatus: payment?.status ?? 'none', reservation: o.reservation, refunded: o.refundedAmount,
          confirmationUrl: payment?.status === 'requires_action' ? payment.confirmationUrl : null, documents: this.#docRefs(o.documentIds, partyId),
          escrow: o.escrow, orderCurrency: o.currency,
        });
      }
      if (o.payeeId === partyId && o.status !== 'awaiting_payment' && o.status !== 'canceled') {
        const q = payment?.quote;
        out.push({
          kind: 'income', at: o.createdAt, orderId: o.id, product: o.product, description: o.description,
          amount: o.payeeNet || q?.payee.net || 0, currency: o.currency, status: o.status, reservation: o.reservation,
          settled: o.settled, refunded: o.refundedAmount, documents: this.#docRefs(o.documentIds, partyId), escrow: o.escrow, orderCurrency: o.currency,
        });
      }
    }
    for (const r of this.store.refunds.values()) {
      const o = this.store.orders.get(r.orderId);
      if (o.payerId === partyId) out.push({ kind: 'refund', at: r.createdAt, orderId: o.id, description: o.description, amount: r.payerAmount, currency: r.payerCurrency, status: r.status });
    }
    for (const p of this.store.payouts.values()) {
      if (p.partyId === partyId) out.push({ kind: 'payout', at: p.createdAt, payoutId: p.id, description: `Выплата на ${p.destination}`, amount: -p.amount, currency: p.currency, status: p.status, documents: this.#docRefs(p.documentId ? [p.documentId] : [], partyId) });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }

  #docRefs(ids, partyId) {
    return ids.map((id) => this.store.documents.get(id)).filter((d) => d.partyIds.includes(partyId)).map((d) => ({ id: d.id, type: d.type, title: d.title }));
  }

  documentsOf(partyId) {
    return [...this.store.documents.values()].filter((d) => d.partyIds.includes(partyId)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  getDocument(id, partyId) {
    const d = this.store.documents.get(id);
    if (!d || (partyId && !d.partyIds.includes(partyId))) throw new PayError('document_not_found', 'Документ не найден', 404);
    return d;
  }

  notificationsOf(partyId) {
    return [...this.store.notifications.values()].filter((n) => n.partyId === partyId).sort((a, b) => b.at.localeCompare(a.at));
  }

  subscriptionsOf(userId) {
    return [...this.store.subscriptions.values()].filter((s) => s.userId === userId);
  }

  // --- Pay Platform -----------------------------------------------------------

  businessSummary(merchantId) {
    this.require('businessCabinet');
    if (!this.isMerchant(merchantId)) throw new PayError('not_a_business', 'Кабинет доступен только бизнесу', 403);
    const byCurrency = {};
    for (const o of this.store.orders.values()) {
      if (o.payeeId !== merchantId || !o.capturedPaymentId) continue;
      const q = this.store.payments.get(o.capturedPaymentId).quote;
      const s = (byCurrency[o.currency] ??= { currency: o.currency, orders: 0, turnover: 0, acquiringFees: 0, parriFees: 0, refunds: 0, net: 0 });
      s.orders += 1;
      s.turnover += o.amount;
      s.acquiringFees += o.acquiringFeeCharged ?? q.payee.acquiringFee;
      s.parriFees += o.parriFeeCollected - o.parriFeeReturned;
      s.refunds += o.refundedAmount;
      s.net += o.payeeNet;
    }
    return { merchantId, totals: Object.values(byCurrency), balance: this.balance(merchantId) };
  }

  reconciliation(partnerId) {
    this.require('reconciliation');
    const partner = this.#partner(partnerId);
    return reconcile({ store: this.store, partnerId, report: partner.report() });
  }

  // --- Internals --------------------------------------------------------------

  #partner(id) {
    const p = this.partners[id];
    if (!p) throw new PayError('partner_unavailable', `Партнёр ${id} не подключён`, 503);
    return p;
  }

  #paymentByPartnerId(partnerId, partnerPaymentId) {
    return this.#byPartnerId('payments', partnerId, partnerPaymentId);
  }

  #byPartnerId(collection, partnerId, partnerOpId) {
    const field = { payments: 'partnerPaymentId', refunds: 'partnerRefundId', payouts: 'partnerPayoutId' }[collection];
    for (const item of this.store[collection].values()) {
      if (item.partner === partnerId && item[field] === partnerOpId) return item;
    }
    // Our record may not be linked yet (notification arrived before the partner's API reply): retry later.
    throw new PayError('unknown_operation', `Операция ${partnerOpId} не найдена`, 404);
  }

  #transition(payment, to, note) {
    if (!PAYMENT_TRANSITIONS[payment.status].includes(to)) {
      throw new PayError('invalid_transition', `Недопустимый переход платежа ${payment.status} → ${to}`, 409);
    }
    payment.status = to;
    payment.history.push({ status: to, at: this.now().toISOString(), ...(note ? { note } : {}) });
  }

  #assertOrderActor(order, actorId, roles) {
    if (actorId === `service:${order.product}` && roles.includes('service')) return;
    if (actorId === order.payerId && roles.includes('payer')) return;
    if (actorId === order.payeeId && roles.includes('payee')) return;
    throw new PayError('forbidden', 'Нет прав на это действие с заказом', 403);
  }

  #orderEvent(order, event, text) {
    order.history.push({ at: this.now().toISOString(), event, text });
  }

  #notify(partyId, text, ref) {
    const n = { id: Store.id('ntf'), partyId, text, ref, at: this.now().toISOString() };
    this.store.notifications.set(n.id, n);
  }

  #accrueBonus(order) {
    const points = bps(order.amount, PRODUCTS[order.product].bonusBps);
    if (points <= 0) return;
    this.ledger.post({ operationId: `bonus:${order.id}`, description: `Бонусы за заказ ${order.id}`, currency: 'BONUS', transfers: [{ from: 'external:bonus_program', to: `bonus:${order.payerId}`, amount: points }] });
    order.bonusPoints = points;
  }

  #clawBackBonus(order, refund) {
    if (!order.bonusPoints) return;
    const points = Math.min(Math.round((order.bonusPoints * refund.amount) / order.amount), this.ledger.balance(`bonus:${order.payerId}`, 'BONUS'));
    if (points > 0) {
      this.ledger.post({ operationId: `bonus_back:${refund.id}`, description: `Списание бонусов по возврату ${refund.id}`, currency: 'BONUS', transfers: [{ from: `bonus:${order.payerId}`, to: 'external:bonus_program', amount: points }] });
    }
  }

  #issueDocument(type, order, payment, extra = {}) {
    const titles = {
      receipt: 'Чек об оплате',
      act: 'Акт об оказании услуг и расчёте с исполнителем',
      income_statement: 'Отчёт о поступлении',
      refund_receipt: 'Чек возврата',
      payout_statement: 'Подтверждение выплаты',
    };
    const doc = { id: Store.id('doc'), type, title: titles[type], issuedAt: this.now().toISOString(), orderId: order?.id ?? null, lines: [], notes: [] };
    const q = payment?.quote;
    if (type === 'receipt') {
      doc.partyIds = [order.payerId];
      doc.lines = [
        { label: order.description, amount: order.amount, currency: order.currency },
        ...(q.payer.currency !== order.currency ? [
          { label: `Сумма в валюте оплаты (${rateLabel(q.payer.rate, order.currency, q.payer.currency)})`, amount: q.payer.converted, currency: q.payer.currency },
          { label: 'Стоимость конвертации', amount: q.payer.fxCost, currency: q.payer.currency },
        ] : []),
        { label: 'Итого списано', amount: q.payer.total, currency: q.payer.currency, total: true },
      ];
      if (order.escrow) doc.notes.push('Средства зарезервированы и будут переведены исполнителю после завершения заказа.');
    } else if (type === 'act' || type === 'income_statement') {
      doc.partyIds = [order.payeeId, ...(type === 'act' ? [order.payerId] : [])];
      doc.lines = [
        { label: 'Стоимость заказа', amount: order.amount - order.refundedAmount, currency: order.currency },
        { label: `Комиссия эквайринга (${q.payee.acquiringFeeBps / 100}%, партнёр ${payment.partner})`, amount: -order.acquiringFeeCharged, currency: order.currency },
        { label: `Комиссия Parri (${q.payee.parriFeeBps / 100}%)`, amount: -order.parriFeeCollected, currency: order.currency },
        { label: 'К получению', amount: order.payeeNet, currency: order.currency, total: true },
      ];
      doc.notes.push(`Средства станут доступны к выплате после расчёта партнёра (${MARKETS[order.market].settlementDelayDays} дн.).`);
    } else if (type === 'refund_receipt') {
      const { refund } = extra;
      doc.partyIds = [order.payerId, order.payeeId];
      doc.lines = [{ label: `Возврат по заказу «${order.description}»`, amount: refund.payerAmount, currency: refund.payerCurrency, total: true }];
      if (q.payer.fxCost) doc.notes.push('Стоимость конвертации не возвращается.');
      if (refund.reason) doc.notes.push(`Причина: ${refund.reason}`);
    } else if (type === 'payout_statement') {
      const { payout } = extra;
      doc.partyIds = [payout.partyId];
      doc.lines = [{ label: `Выплата на ${payout.destination}`, amount: payout.amount, currency: payout.currency, total: true }];
      doc.notes.push(`Партнёр: ${payout.partner}, операция ${payout.partnerPayoutId}`);
    }
    this.store.documents.set(doc.id, doc);
    order?.documentIds.push(doc.id);
    return doc;
  }
}

function rateLabel(rate, from, to) {
  return rate >= 1 ? `1 ${from} = ${rate.toFixed(4)} ${to}` : `1 ${to} = ${(1 / rate).toFixed(2)} ${from}`;
}

function maskDestination(dest) {
  const s = String(dest);
  return s.length <= 4 ? '****' : `****${s.replace(/:[A-Z]{3}$/, '').slice(-4)}`;
}
