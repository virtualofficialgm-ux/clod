import { MARKETS, PRODUCTS, PARTNERS } from './config.js';
import { bps, convertForPayer, PayError } from './money.js';

// Fee breakdown for an order. Acquiring fee, Parri commission and conversion cost
// are always disclosed as separate lines and never merged into one "fee".
export function quote({ market, product, amount, payerCurrency }) {
  const m = MARKETS[market];
  const p = PRODUCTS[product];
  if (!m) throw new PayError('unknown_market', `Рынок ${market} не поддерживается`);
  if (!p) throw new PayError('unknown_product', `Продукт ${product} не подключён к Pay`);
  const currency = payerCurrency ?? m.settlementCurrency;
  if (!m.paymentCurrencies.includes(currency)) {
    throw new PayError('unsupported_currency', `Валюта ${currency} недоступна на рынке ${m.name}`);
  }
  const partner = PARTNERS[m.partner];
  const fx = convertForPayer(amount, m.settlementCurrency, currency);
  const acquiringFee = bps(amount, partner.acquiringFeeBps);
  const parriFee = bps(amount, p.parriFeeBps);
  const payeeNet = amount - acquiringFee - parriFee;
  if (payeeNet <= 0) throw new PayError('amount_too_small', 'Сумма меньше суммы комиссий');
  return {
    settlementCurrency: m.settlementCurrency,
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
      acquiringFeeBps: partner.acquiringFeeBps,
      parriFee,
      parriFeeBps: p.parriFeeBps,
      net: payeeNet,
    },
    partner: m.partner,
  };
}
