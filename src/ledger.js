import { PayError, assertAmount } from './money.js';

// Double-entry ledger built from transfers. A transfer moves `amount` from one
// account to another, so the sum of all balances in each currency is always zero.
//
// Account naming:
//   external:<partner>          money at the partner (bank / provider) — mirror of the outside world
//   escrow:<orderId>            funds reserved for an order until completion
//   user:<id>:pending           received, waiting for partner settlement (expected payout)
//   user:<id>:available         settled, may be paid out
//   merchant:<id>:pending/...   same for brand businesses
//   payout:<id> / refund:<id>   funds locked while the partner processes the operation
//   revenue:parri_fee, revenue:fx, expense:acquiring
//   bonus:<id> (currency BONUS) loyalty points — a separate unit, never money
//
// Every transaction carries a unique operationId; posting the same operation twice
// returns the original transaction instead of moving money again.

const NON_NEGATIVE = /^(user|merchant|escrow|payout|refund|bonus):/;

export class Ledger {
  constructor(store) {
    this.store = store;
  }

  balance(account, currency) {
    return this.store.balances.get(`${account}|${currency}`) ?? 0;
  }

  post({ operationId, description, currency, transfers, meta = {} }) {
    if (!operationId) throw new Error('operationId is required');
    const existing = this.store.ledgerTx.get(operationId);
    if (existing) return { tx: existing, duplicate: true };

    if (!transfers.length) throw new Error('empty transaction');
    const deltas = new Map();
    for (const { from, to, amount } of transfers) {
      assertAmount(amount);
      if (from === to) throw new Error('transfer to the same account');
      deltas.set(from, (deltas.get(from) ?? 0) - amount);
      deltas.set(to, (deltas.get(to) ?? 0) + amount);
    }
    for (const [account, delta] of deltas) {
      if (NON_NEGATIVE.test(account) && this.balance(account, currency) + delta < 0) {
        throw new PayError('insufficient_funds', `Недостаточно средств на счёте ${account}`, 409);
      }
    }
    for (const [account, delta] of deltas) {
      const key = `${account}|${currency}`;
      this.store.balances.set(key, this.balance(account, currency) + delta);
    }
    const tx = {
      id: operationId,
      description,
      currency,
      transfers: transfers.map((t) => ({ ...t })),
      meta,
      createdAt: new Date().toISOString(),
    };
    this.store.ledgerTx.set(operationId, tx);
    return { tx, duplicate: false };
  }

  entries(account) {
    const out = [];
    for (const tx of this.store.ledgerTx.values()) {
      for (const t of tx.transfers) {
        if (t.from === account) out.push({ txId: tx.id, at: tx.createdAt, currency: tx.currency, amount: -t.amount, counterparty: t.to, description: tx.description });
        if (t.to === account) out.push({ txId: tx.id, at: tx.createdAt, currency: tx.currency, amount: t.amount, counterparty: t.from, description: tx.description });
      }
    }
    return out;
  }

  // Sum of all balances per currency; must be zero for every currency.
  trialBalance() {
    const totals = {};
    for (const [key, value] of this.store.balances) {
      const currency = key.split('|')[1];
      totals[currency] = (totals[currency] ?? 0) + value;
    }
    return totals;
  }
}
