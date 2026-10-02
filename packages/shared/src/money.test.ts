import { describe, expect, it } from 'vitest';
import {
  calcFee,
  dollarsToCents,
  formatMoney,
  isRewardInRange,
  priceBreakdown,
  proportionalFeeRefund,
} from './money';

describe('комиссия', () => {
  it('10% сверху награды, исполнитель получает награду целиком', () => {
    expect(priceBreakdown(2500)).toEqual({ reward: 2500, fee: 250, total: 2750, feeBps: 1000 });
  });
  it('округление до цента половиной вверх', () => {
    expect(calcFee(105)).toBe(11); // 10.5 → 11
    expect(calcFee(104)).toBe(10); // 10.4 → 10
    expect(calcFee(100)).toBe(10);
  });
  it('на границах бюджета', () => {
    expect(priceBreakdown(100).total).toBe(110);
    expect(priceBreakdown(1_000_000).total).toBe(1_100_000);
  });
  it('Pro платит ту же комиссию', () => {
    expect(calcFee(2500, 'pro')).toBe(250);
  });
  it('отклоняет дробные и отрицательные суммы', () => {
    expect(() => calcFee(10.5)).toThrow(RangeError);
    expect(() => calcFee(-1)).toThrow(RangeError);
  });
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
