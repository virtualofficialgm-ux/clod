import { MARKETS, PRODUCTS, PARTNERS } from './config.js';
import { bps, convertForPayer, PayError } from './money.js';

// Fee breakdown for an order. Acquiring fee, Parri commission and conversion cost
// are always disclosed as separate lines and never merged into one "fee".
export function quote({ market, product, amount, payerCurrency, source = 'card' }) {
  const m = MARKETS[market];
  const p = PRODUCTS[product];
  if (!m) throw new PayError('unknown_market', `Рынок ${market} не поддерживается`);
  if (!p) throw new PayError('unknown_product', `Продукт ${product} не подключён к Pay`);
  const currency = payerCurrency ?? m.settlementCurrency;
  if (!m.paymentCurrencies.includes(currency)) {
    throw new PayError('unsupported_currency', `Валюта ${currency} недоступна на рынке ${m.name}`);
  }
  if (source === 'balance' && currency !== m.settlementCurrency) {
    throw new PayError('unsupported_currency', `С баланса Parri оплата идёт в ${m.settlementCurrency}`);
  }
  const partner = PARTNERS[m.partner];
  const fx = convertForPayer(amount, m.settlementCurrency, currency);
  // Paying from the Parri balance does not go through card acquiring.
  const acquiringBps = source === 'balance' ? 0 : partner.acquiringFeeBps;
  const acquiringFee = bps(amount, acquiringBps);
  const parriFee = bps(amount, p.parriFeeBps);
  const payeeNet = amount - acquiringFee - parriFee;
  if (payeeNet <= 0) throw new PayError('amount_too_small', 'Сумма меньше суммы комиссий');
  return {
    settlementCurrency: m.settlementCurrency,
    source,
    amount,
    payer: {
      currency,
      rate: fx.rate,
      converted: fx.converted,
      fxCost: fx.fxCost,
      total: fx.total,
    },
    payee: {
      acquiringFee,
      acquiringFeeBps: acquiringBps,
      parriFee,
      parriFeeBps: p.parriFeeBps,
      net: payeeNet,
    },
    partner: m.partner,
  };
}

// Top-up of the Parri balance (an account held by the financial partner).
export function topupQuote({ market, amount }) {
  const m = MARKETS[market];
  if (!m) throw new PayError('unknown_market', `Рынок ${market} не поддерживается`);
  const fee = bps(amount, m.topupFeeBps);
  return { currency: m.settlementCurrency, amount, fee, feeBps: m.topupFeeBps, total: amount + fee, partner: m.partner };
}

// Person-to-person transfer. Inside Parri Pay it is free and instant; to another
// bank it goes through the partner and its fee is shown on its own line.
export function transferQuote({ market, type, amount, method }) {
  const m = MARKETS[market];
  if (!m) throw new PayError('unknown_market', `Рынок ${market} не поддерживается`);
  if (type === 'pay') {
    return { type, currency: m.settlementCurrency, amount, fee: 0, feeBps: 0, total: amount, arrival: 'Мгновенно' };
  }
  if (type !== 'bank') throw new PayError('invalid_transfer', 'Неизвестный тип перевода');
  const bt = m.bankTransfer;
  if (!bt.methods.includes(method)) throw new PayError('method_unavailable', 'Этот способ перевода недоступен на вашем рынке');
  const fee = amount > 0 ? Math.max(bps(amount, bt.feeBps), bt.minFee) : 0;
  const arrival = { phone: 'Обычно до минуты', card: 'До 1 рабочего дня', account: '1–2 рабочих дня' }[method];
  return { type, method, currency: m.settlementCurrency, amount, fee, feeBps: bt.feeBps, minFee: bt.minFee, total: amount + fee, arrival };
}
