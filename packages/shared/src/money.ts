/**
 * Денежная логика. Все суммы — целые центы USD.
 * Комиссию платит заказчик сверху награды; исполнитель получает награду целиком.
 * Та же формула продублирована в SQL (supabase/migrations) — тесты сверяют обе.
 */

export type PlanId = 'free' | 'pro';

export const CURRENCY = 'USD';
export const MIN_REWARD_CENTS = 100; // $1
export const MAX_REWARD_CENTS = 1_000_000; // $10 000

/**
 * Шкала комиссии за публикацию (базисные пункты, 100 = 1%), как на theparri.com:
 * до $49.99 — 5%, от $50 — 4%, от $100 — 3,5%, от $200 — 3%, от $500 — 2,5%.
 * Тариф на комиссию не влияет (0% — только у тарифа Max, его пока нет).
 */
export const FEE_TIERS: readonly { fromCents: number; bps: number }[] = [
  { fromCents: 50_000, bps: 250 },
  { fromCents: 20_000, bps: 300 },
  { fromCents: 10_000, bps: 350 },
  { fromCents: 5_000, bps: 400 },
  { fromCents: 0, bps: 500 },
];

export function feeBpsForReward(rewardCents: number): number {
  assertCents(rewardCents, 'reward');
  return FEE_TIERS.find((t) => rewardCents >= t.fromCents)!.bps;
}

export function assertCents(value: number, name = 'amount'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents`);
  }
}

/** Комиссия по ставке в базисных пунктах, округление до цента «половина вверх» */
export function calcFeeBps(rewardCents: number, feeBps: number): number {
  assertCents(rewardCents, 'reward');
  return Math.floor((rewardCents * feeBps + 5000) / 10000);
}

/** Комиссия за публикацию задачи с такой наградой */
export function calcFee(rewardCents: number): number {
  return calcFeeBps(rewardCents, feeBpsForReward(rewardCents));
}

export interface PriceBreakdown {
  reward: number;
  fee: number;
  total: number;
  feeBps: number;
}

export function priceBreakdown(rewardCents: number): PriceBreakdown {
  const feeBps = feeBpsForReward(rewardCents);
  const fee = calcFeeBps(rewardCents, feeBps);
  return { reward: rewardCents, fee, total: rewardCents + fee, feeBps };
}

/** «5%», «3,5%» */
export function formatBps(bps: number, locale = 'ru-RU'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bps / 100)}%`;
}

/** Лимиты денег (зеркало SQL: payout_min_cents, topup_min_cents, request_payout) */
export const MONEY_LIMITS = {
  topupCardMinCents: 500,
  topupUsdtMinCents: 2000,
  payoutCardMinCents: 1000,
  payoutUsdtMinCents: 2000,
  payoutDailyMaxCents: 100_000,
  payoutMinAge: 18,
  topupPresetsCents: [1000, 2500, 5000, 10000, 20000],
} as const;

export const SUBSCRIPTION_PRICES = {
  pro: { month: 1500, year: 14400 },
} as const;

export type MoneyCurrency = 'USD' | 'USDT';

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

export function formatMoney(
  cents: number,
  locale = 'ru-RU',
  opts: { compact?: boolean; currency?: MoneyCurrency | 'RUB' | 'EUR' | 'AED' | 'KZT' } = {},
): string {
  const whole = cents % 100 === 0;
  const digits = { minimumFractionDigits: whole || opts.compact ? 0 : 2, maximumFractionDigits: opts.compact ? 0 : 2 };
  if (opts.currency === 'USDT') {
    return `${new Intl.NumberFormat(locale, digits).format(cents / 100)} USDT`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: opts.currency ?? CURRENCY,
    currencyDisplay: 'narrowSymbol',
    ...digits,
  }).format(cents / 100);
}

/**
 * Сумма в долларах для справки в валюте отображения (рубли по курсу ЦБ и т. п.).
 * Деньги на счетах не меняются — это только подпись.
 */
export function convertForDisplay(usdCents: number, perUsd: number): number {
  return Math.round(usdCents * perUsd);
}

/** Рубли (копейки) → центы по курсу: так же, как сервер (round(amount / per_usd)) */
export function rubToUsdCents(rubKopecks: number, perUsd: number): number {
  return Math.round(rubKopecks / perUsd);
}

/** Цена для показа: в долларах/USDT или «≈ … ₽» по курсу ЦБ (только справка) */
export function formatPrice(cents: number, currency: MoneyCurrency, display: 'USD' | 'RUB', rubPerUsd?: number | null): string {
  if (currency === 'USDT') return formatMoney(cents, 'ru-RU', { currency: 'USDT' });
  if (display === 'RUB' && rubPerUsd) return `≈ ${formatMoney(convertForDisplay(cents, rubPerUsd), 'ru-RU', { currency: 'RUB', compact: true })}`;
  return formatMoney(cents);
}
