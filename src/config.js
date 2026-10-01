// Static configuration of the sandbox deployment.
// All amounts are integers in minor units of the market's settlement currency.

// Development levels. Each level unlocks a set of capabilities;
// a higher level includes everything below it.
export const LEVELS = {
  connect: {
    rank: 1,
    title: 'Pay Connect',
    summary: 'Интеграция приёма платежей и выплат',
    transition: 'Работающий основной продукт и договоры с партнёрами',
  },
  platform: {
    rank: 2,
    title: 'Pay Platform',
    summary: 'API, сверка, антифрод и кабинет бизнеса',
    transition: 'Подтверждённый объём операций и надёжный учёт',
  },
  network: {
    rank: 3,
    title: 'Pay Network',
    summary: 'Собственные правила участия и расчётная модель',
    transition: 'Отдельная оценка регулирования, капитала и сети участников',
  },
};

// Capability -> minimal level that enables it.
export const CAPABILITIES = {
  payments: 'connect',
  payouts: 'connect',
  refunds: 'connect',
  subscriptions: 'connect',
  documents: 'connect',
  businessApi: 'platform',
  reconciliation: 'platform',
  antifraud: 'platform',
  businessCabinet: 'platform',
  ownSettlement: 'network',
};

// Network level is a separate long-term programme: it is never enabled in code
// until regulation, capital and participant network are assessed.
export const IMPLEMENTED_LEVELS = ['connect', 'platform'];

// Each market has its own partners, currencies and identification procedures.
// A single interface does not mean a single bank for all countries.
export const MARKETS = {
  AM: {
    name: 'Армения',
    settlementCurrency: 'AMD',
    paymentCurrencies: ['AMD', 'USD'],
    partner: 'sandbox-am',
    settlementDelayDays: 1,
    topupFeeBps: 0,
    kyc: {
      basic: { title: 'Базовая', procedure: 'Телефон и e-mail', maxPayment: 20_000_000, monthlyPayout: 50_000_000, maxBalance: 30_000_000 },
      verified: { title: 'Полная', procedure: 'Паспорт и видеоидентификация', maxPayment: 200_000_000, monthlyPayout: 1_000_000_000, maxBalance: 2_000_000_000 },
    },
    // Regulated products are only added through a permitted model (own licence or licensed partner).
    regulated: { lending: false, deposits: false, cardIssuing: false },
  },
  KZ: {
    name: 'Казахстан',
    settlementCurrency: 'KZT',
    paymentCurrencies: ['KZT'],
    partner: 'sandbox-kz',
    settlementDelayDays: 2,
    topupFeeBps: 0,
    kyc: {
      basic: { title: 'Базовая', procedure: 'Телефон и ИИН', maxPayment: 25_000_000, monthlyPayout: 50_000_000, maxBalance: 50_000_000 },
      verified: { title: 'Полная', procedure: 'Удостоверение личности и биометрия', maxPayment: 500_000_000, monthlyPayout: 2_000_000_000, maxBalance: 5_000_000_000 },
    },
    regulated: { lending: false, deposits: false, cardIssuing: false },
  },
  EU: {
    name: 'Европейский союз',
    settlementCurrency: 'EUR',
    paymentCurrencies: ['EUR', 'USD'],
    partner: 'sandbox-eu',
    settlementDelayDays: 1,
    topupFeeBps: 100,
    kyc: {
      basic: { title: 'Базовая', procedure: 'E-mail и телефон, лимит по PSD2', maxPayment: 15_000, monthlyPayout: 100_000, maxBalance: 15_000 },
      verified: { title: 'Полная', procedure: 'Документ и проверка адреса', maxPayment: 1_000_000, monthlyPayout: 5_000_000, maxBalance: 10_000_000 },
    },
    regulated: { lending: false, deposits: false, cardIssuing: false },
  },
};

// Sandbox FX mid rates: how many units of `to` one unit of `from` buys.
export const FX_RATES = {
  'USD:AMD': 387.5,
  'USD:EUR': 0.92,
  'USD:KZT': 482.0,
};
// Conversion markup charged to the payer, in basis points. Shown as a separate line.
export const FX_MARKUP_BPS = 150;

// Brand products served by Pay.
// escrow: funds are reserved until the order is completed (marketplace model).
// parriFeeBps: Parri service commission withheld from the payee.
// bonusBps: bonus points accrued to the payer; bonuses are a separate unit, never money.
export const PRODUCTS = {
  tasks: { title: 'Parri Tasks', escrow: true, parriFeeBps: 800, bonusBps: 0, merchant: null },
  fit: {
    title: 'Parri Fit',
    escrow: false,
    parriFeeBps: 300,
    bonusBps: 0,
    merchant: 'm_fit',
    plans: {
      fit_pro: { title: 'Fit Pro — месяц', periodDays: 30, price: { AM: 390_000, KZ: 490_000, EU: 999 } },
    },
  },
  food: { title: 'Parri Food', escrow: false, parriFeeBps: 500, bonusBps: 100, merchant: 'm_food' },
};

// Partners (banks / payment providers). Acquiring fee is the partner's, disclosed separately.
export const PARTNERS = {
  'sandbox-am': { title: 'Sandbox Acquirer AM', acquiringFeeBps: 180, webhookSecret: 'whsec_sandbox_am' },
  'sandbox-kz': { title: 'Sandbox Acquirer KZ', acquiringFeeBps: 200, webhookSecret: 'whsec_sandbox_kz' },
  'sandbox-eu': { title: 'Sandbox Acquirer EU', acquiringFeeBps: 140, webhookSecret: 'whsec_sandbox_eu' },
};

// Brand services authenticate to the Pay API with keys (sandbox values).
export const SERVICE_API_KEYS = {
  sk_sandbox_tasks: 'tasks',
  sk_sandbox_fit: 'fit',
  sk_sandbox_food: 'food',
};

// Parri Key versions. The move between versions depends on test results and
// production economics, so availability is configuration, not code.
export const KEY_MODELS = {
  core: {
    title: 'Key Core',
    summary: 'Аппаратный ключ и кошелёк цифровых активов с приложением',
    stage: 'available',
    features: { display: false, ring: false, biometric: false, contactless: false },
    presence: 'кнопку на ключе',
  },
  pay: {
    title: 'Key Pay',
    summary: 'Платёжная версия с партнёром-эмитентом',
    stage: 'issuer_required',
    features: { display: false, ring: false, biometric: true, contactless: true },
    presence: 'палец к сенсору',
  },
  signature: {
    title: 'Key Signature',
    summary: 'Премиальное исполнение: E-Ink дисплей, тактильное кольцо, биометрия, титан и сапфировое стекло',
    stage: 'prototype',
    features: { display: true, ring: true, biometric: true, contactless: true },
    presence: 'палец к сенсору',
  },
};

export const KEY_STAGES = {
  available: 'Доступна',
  issuer_required: 'Платёжная функция — после договора с партнёром-эмитентом',
  prototype: 'Инженерный образец: выпуск после проверки дисплея, кольца и биометрии',
};

export const SEED_USERS = [
  { id: 'u_anna', name: 'Анна', market: 'AM', kycLevel: 'verified' },
  { id: 'u_boris', name: 'Борис (исполнитель)', market: 'AM', kycLevel: 'basic' },
  { id: 'u_dana', name: 'Дана', market: 'KZ', kycLevel: 'basic' },
  { id: 'u_emil', name: 'Эмиль', market: 'EU', kycLevel: 'verified' },
];

export const SEED_MERCHANTS = [
  { id: 'm_fit', name: 'Parri Fit', product: 'fit' },
  { id: 'm_food', name: 'Parri Food', product: 'food' },
];

export function levelEnabled(current, required) {
  return LEVELS[current].rank >= LEVELS[required].rank;
}

export function capabilityEnabled(level, capability) {
  const required = CAPABILITIES[capability];
  if (!required) throw new Error(`Unknown capability ${capability}`);
  if (!IMPLEMENTED_LEVELS.includes(required)) return false;
  return levelEnabled(level, required);
}
