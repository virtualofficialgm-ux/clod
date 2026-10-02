/**
 * Денежная логика. Все суммы — целые центы USD.
 * Комиссию платит заказчик сверху награды; исполнитель получает награду целиком.
 * Та же формула продублирована в SQL (supabase/migrations) — тесты сверяют обе.
 */

export type PlanId = 'free' | 'pro';

export const CURRENCY = 'USD';
export const MIN_REWARD_CENTS = 100; // $1
export const MAX_REWARD_CENTS = 1_000_000; // $10 000

/** Ставка комиссии за публикацию в базисных пунктах (1000 = 10%) */
export const FEE_BPS: Record<PlanId, number> = {
  free: 1000,
  pro: 1000,
};

export function assertCents(value: number, name = 'amount'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents`);
  }
}

/** Комиссия с округлением до цента по правилу «половина вверх» */
export function calcFee(rewardCents: number, plan: PlanId = 'free'): number {
  assertCents(rewardCents, 'reward');
  return Math.floor((rewardCents * FEE_BPS[plan] + 5000) / 10000);
}

export interface PriceBreakdown {
  reward: number;
  fee: number;
  total: number;
  feeBps: number;
}

export function priceBreakdown(rewardCents: number, plan: PlanId = 'free'): PriceBreakdown {
  const fee = calcFee(rewardCents, plan);
  return { reward: rewardCents, fee, total: rewardCents + fee, feeBps: FEE_BPS[plan] };
}

export function isRewardInRange(rewardCents: number): boolean {
  return (
    Number.isInteger(rewardCents) &&
    rewardCents >= MIN_REWARD_CENTS &&
    rewardCents <= MAX_REWARD_CENTS
  );
}

/**
 * Доля комиссии, возвращаемая заказчику при частичном возврате награды.
 * Округление вниз: платформа никогда не возвращает больше, чем удержала.
 */
export function proportionalFeeRefund(
  feeCents: number,
  rewardCents: number,
  refundedRewardCents: number,
): number {
  assertCents(feeCents, 'fee');
  assertCents(rewardCents, 'reward');
  assertCents(refundedRewardCents, 'refundedReward');
  if (refundedRewardCents > rewardCents) throw new RangeError('refund exceeds reward');
  if (rewardCents === 0) return 0;
  return Math.floor((feeCents * refundedRewardCents) / rewardCents);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatMoney(cents: number, locale = 'ru-RU', opts: { compact?: boolean } = {}): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: whole || opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(cents / 100);
}
