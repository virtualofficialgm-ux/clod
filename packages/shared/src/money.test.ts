import { describe, expect, it } from 'vitest';
import {
  calcFee,
  convertForDisplay,
  feeBpsForReward,
  formatBps,
  rubToUsdCents,
  dollarsToCents,
  formatMoney,
  isRewardInRange,
  priceBreakdown,
  proportionalFeeRefund,
} from './money';

describe('комиссия по шкале', () => {
  it.each([
    [100, 500, 5],
    [4999, 500, 250],
    [5000, 400, 200],
    [9999, 400, 400],
    [10000, 350, 350],
    [19999, 350, 700],
    [20000, 300, 600],
    [49999, 300, 1500],
    [50000, 250, 1250],
    [1_000_000, 250, 25000],
  ])('награда %d ¢ → %d б.п., комиссия %d ¢', (reward, bps, fee) => {
    expect(feeBpsForReward(reward)).toBe(bps);
    expect(calcFee(reward)).toBe(fee);
  });
  it('пример с сайта: задача на $500 — комиссия $12.50', () => {
    expect(priceBreakdown(50000)).toEqual({ reward: 50000, fee: 1250, total: 51250, feeBps: 250 });
  });
  it('исполнитель получает награду целиком, комиссия сверху', () => {
    expect(priceBreakdown(2500)).toEqual({ reward: 2500, fee: 125, total: 2625, feeBps: 500 });
  });
  it('округление до цента половиной вверх', () => {
    expect(calcFee(110)).toBe(6); // 5.5 → 6
    expect(calcFee(109)).toBe(5); // 5.45 → 5
  });
  it('отклоняет дробные и отрицательные суммы', () => {
    expect(() => calcFee(10.5)).toThrow(RangeError);
    expect(() => calcFee(-1)).toThrow(RangeError);
  });
  it('подпись ставки', () => {
    expect(formatBps(350)).toBe('3,5%');
    expect(formatBps(500)).toBe('5%');
  });
});

describe('курсы', () => {
  it('рубли → центы так же, как на сервере', () => {
    expect(rubToUsdCents(203750, 81.5)).toBe(2500);
    expect(convertForDisplay(2500, 81.5)).toBe(203750);
  });
  it('USDT подписывается отдельно', () => expect(formatMoney(2000, 'ru-RU', { currency: 'USDT' })).toMatch(/^20\sUSDT$/));
});

describe('диапазон бюджета $1–$10 000', () => {
  it.each([
    [99, false],
    [100, true],
    [1_000_000, true],
    [1_000_001, false],
    [150.5, false],
  ])('%d → %s', (cents, ok) => expect(isRewardInRange(cents)).toBe(ok));
});

describe('пропорциональный возврат комиссии', () => {
  it('полный возврат — вся комиссия', () => expect(proportionalFeeRefund(250, 2500, 2500)).toBe(250));
  it('половина — половина комиссии', () => expect(proportionalFeeRefund(250, 2500, 1250)).toBe(125));
  it('округление вниз', () => expect(proportionalFeeRefund(11, 105, 50)).toBe(5));
  it('нельзя вернуть больше награды', () =>
    expect(() => proportionalFeeRefund(250, 2500, 2501)).toThrow(RangeError));
});

describe('форматирование', () => {
  it('целые доллары без копеек', () => expect(formatMoney(2500)).toMatch(/^25\s?\$$/));
  it('с центами', () => expect(formatMoney(2750 + 5)).toMatch(/^27,55\s?\$$/));
  it('доллары в центы без ошибок плавающей точки', () => expect(dollarsToCents(19.99)).toBe(1999));
});
