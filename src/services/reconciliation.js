// Reconciliation of Parri's records against the partner's settlement report (Pay Platform).
// Our operation id is the partner's idempotency key, so records are matched one-to-one.
const STATUS_MAP = {
  pay: { requires_action: 'requires_action', processing: 'processing', succeeded: 'succeeded', failed: 'failed', canceled: 'canceled' },
  ref: { processing: 'processing', succeeded: 'succeeded', failed: 'failed' },
  out: { processing: 'processing', succeeded: 'succeeded', failed: 'failed' },
};
const COLLECTION = { pay: 'payments', ref: 'refunds', out: 'payouts' };

export function reconcile({ store, partnerId, report }) {
  const issues = [];
  const seen = new Set();
  let matched = 0;
  for (const row of report) {
    const ours = store[COLLECTION[row.kind]].get(row.idempotencyKey) ?? (row.kind === 'pay' ? store.topups.get(row.idempotencyKey) : undefined);
    seen.add(row.idempotencyKey);
    if (!ours) {
      issues.push({ type: 'missing_in_parri', partnerOperation: row.partnerId, kind: row.kind, amount: row.amount, status: row.status });
      continue;
    }
    const expectedAmount = row.kind === 'pay' ? (ours.quote ? ours.quote.payer.total : ours.total) : row.kind === 'ref' ? ours.payerAmount : ours.amount;
    if (expectedAmount !== row.amount) {
      issues.push({ type: 'amount_mismatch', id: ours.id, parri: expectedAmount, partner: row.amount });
    }
    const ourStatus = ours.status;
    const theirs = STATUS_MAP[row.kind][row.status];
    // A canceled-by-Parri payment that the partner captured is resolved by an automatic refund.
    if (ourStatus !== theirs) issues.push({ type: 'status_mismatch', id: ours.id, parri: ourStatus, partner: row.status });
    else matched += 1;
  }
  for (const collection of [...Object.values(COLLECTION), 'topups']) {
    for (const ours of store[collection].values()) {
      if (ours.partner !== partnerId || seen.has(ours.id)) continue;
      // Internal operations never reach the partner: balance payments, payouts awaiting Key confirmation.
      if (ours.source === 'balance' || ours.toBalance || ours.status === 'awaiting_confirmation') continue;
      if (ours.status === 'failed' && !ours.partnerPaymentId && !ours.partnerRefundId && !ours.partnerPayoutId) continue; // never reached the partner
      issues.push({ type: 'missing_at_partner', id: ours.id, kind: collection, status: ours.status });
    }
  }
  return { partnerId, checkedAt: new Date().toISOString(), operations: report.length, matched, issues };
}
