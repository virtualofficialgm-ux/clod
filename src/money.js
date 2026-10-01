import { FX_RATES, FX_MARKUP_BPS } from './config.js';

const MINOR_UNITS = { AMD: 2, KZT: 2, EUR: 2, USD: 2 };

export function assertAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new PayError('invalid_amount', 'Сумма должна быть положительным целым числом в минимальных единицах валюты');
  }
}

export function bps(amount, basisPoints) {
  // Round half up; fees are never fractional minor units.
  return Math.round((amount * basisPoints) / 10_000);
}

export function rate(from, to) {
  if (from === to) return 1;
  if (FX_RATES[`${from}:${to}`]) return FX_RATES[`${from}:${to}`];
  if (FX_RATES[`${to}:${from}`]) return 1 / FX_RATES[`${to}:${from}`];
  throw new PayError('unsupported_currency', `Нет курса ${from} → ${to}`);
}

// Converts an order price (in settlement currency) into the payer's currency.
// The conversion cost is returned separately so that it can be disclosed on its own line.
export function convertForPayer(amount, settlementCurrency, payerCurrency) {
  if (settlementCurrency === payerCurrency) {
    return { rate: 1, converted: amount, fxCost: 0, total: amount };
  }
  const r = rate(settlementCurrency, payerCurrency) * 10 ** (MINOR_UNITS[payerCurrency] - MINOR_UNITS[settlementCurrency]);
  const converted = Math.max(1, Math.round(amount * r));
  const fxCost = bps(converted, FX_MARKUP_BPS);
  return { rate: rate(settlementCurrency, payerCurrency), converted, fxCost, total: converted + fxCost };
}

export function format(amount, currency) {
  const digits = MINOR_UNITS[currency] ?? 2;
  const value = (amount / 10 ** digits).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${value} ${currency}`;
}

export class PayError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
