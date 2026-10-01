// Basic rule-based antifraud (Pay Platform). Returns a decision with reasons so
// that support and the business cabinet can explain every rejection.
const VELOCITY_WINDOW_MS = 10 * 60 * 1000;
const VELOCITY_LIMIT = 5;

export function evaluatePayment({ store, payerId, amount, kycLimits, now }) {
  const reasons = [];
  const since = now.getTime() - VELOCITY_WINDOW_MS;
  let recent = 0;
  let recentFailed = 0;
  for (const p of store.payments.values()) {
    if (p.payerId !== payerId || Date.parse(p.createdAt) < since) continue;
    recent += 1;
    if (p.status === 'failed') recentFailed += 1;
  }
  if (recent >= VELOCITY_LIMIT) reasons.push(`Слишком много платежей: ${recent} за 10 минут`);
  if (recentFailed >= 3) reasons.push(`Серия отклонённых платежей: ${recentFailed} за 10 минут`);
  if (amount > kycLimits.maxPayment * 0.9 && recent > 0) {
    reasons.push('Крупный платёж сразу после предыдущего — требуется проверка');
  }
  return { decision: reasons.length ? 'block' : 'allow', reasons };
}
