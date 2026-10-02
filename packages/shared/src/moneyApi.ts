/** Деньги на клиенте: пополнение, вывод, подписка, возвраты, квитанции, курсы. Баланс меняет только сервер. */
import { ApiError, toApiError, unwrap, type Client } from './api';
import type { MoneyCurrency } from './money';

export type CryptoNetwork = 'TRC20' | 'ERC20' | 'BEP20';
export const CRYPTO_NETWORKS: readonly CryptoNetwork[] = ['TRC20', 'ERC20', 'BEP20'];

export interface Payment {
  id: string;
  user_id: string;
  kind: 'topup' | 'subscription';
  provider: 'stripe' | 'nowpayments' | 'manual';
  currency: MoneyCurrency;
  amount_cents: number;
  refunded_cents: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded';
  network: CryptoNetwork | null;
  pay_address: string | null;
  pay_amount: string | null;
  failure_reason: string | null;
  credited_tx: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  user_id: string;
  method: 'stripe' | 'usdt';
  currency: MoneyCurrency;
  amount_cents: number;
  status: 'requested' | 'on_hold' | 'approved' | 'processing' | 'paid' | 'failed' | 'rejected';
  network: CryptoNetwork | null;
  address: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundRequest {
  id: string;
  payment_id: string | null;
  ledger_tx: string | null;
  reason: 'not_provided' | 'double_charge' | 'unknown' | 'other';
  amount_cents: number;
  currency: MoneyCurrency;
  details: string;
  status: 'created' | 'reviewing' | 'refunded' | 'rejected';
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  user_id: string;
  plan: 'pro';
  billing_interval: 'month' | 'year';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface ConnectAccount {
  account_id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
}

export interface CryptoAddress {
  id: string;
  network: CryptoNetwork;
  address: string;
  label: string | null;
}

export interface FxRate {
  currency: string;
  per_usd: number;
  source: string;
  fetched_at: string;
}

export interface Receipt {
  tx_id: string;
  kind: string;
  created_at: string;
  currency: MoneyCurrency;
  task: { id: string; title: string; reward_cents: number; fee_cents: number; fee_bps: number } | null;
  entries: { account: string; amount_cents: number; currency: MoneyCurrency; memo: string | null }[];
}

/** Вызов Edge Function payments с переводом ошибок в ключи errors.* */
async function invoke<T>(sb: Client, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke<T>('payments', { body });
  if (error) {
    let code = 'unknown';
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? ((await ctx.json()) as { error?: string }) : null;
      if (j?.error) code = j.error;
    } catch {}
    throw toApiError({ message: code });
  }
  return data as T;
}

export const money = {
  // ----- Пополнение -----
  topupCard(sb: Client, amountCents: number, returnUrl: string) {
    return invoke<{ payment_id: string; url: string }>(sb, {
      action: 'topup',
      method: 'card',
      amount_cents: amountCents,
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=success`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=canceled`,
    });
  },
  /** Платёж по id сессии Stripe (после возврата со страницы оплаты) */
  paymentByRef(sb: Client, ref: string) {
    return unwrap<Payment | null>(sb.from('payments').select('*').eq('provider_ref', ref).maybeSingle());
  },
  topupUsdt(sb: Client, amountCents: number, network: CryptoNetwork) {
    return invoke<{ payment_id: string; pay_address: string; pay_amount: number; network: CryptoNetwork }>(sb, {
      action: 'topup',
      method: 'usdt',
      amount_cents: amountCents,
      network,
    });
  },
  checkPayment(sb: Client, paymentId: string) {
    return invoke<Payment>(sb, { action: 'payment_status', payment_id: paymentId });
  },
  payments(sb: Client) {
    return unwrap<Payment[]>(sb.from('payments').select('*').order('created_at', { ascending: false }).limit(100));
  },
  payment(sb: Client, id: string) {
    return unwrap<Payment | null>(sb.from('payments').select('*').eq('id', id).maybeSingle());
  },

  // ----- Вывод -----
  connectOnboarding(sb: Client, returnUrl: string) {
    return invoke<{ url: string }>(sb, { action: 'connect', return_url: returnUrl, refresh_url: returnUrl });
  },
  connectStatus(sb: Client) {
    return invoke<{ connected: boolean; payouts_enabled: boolean; details_submitted: boolean }>(sb, { action: 'connect_status' });
  },
  connectAccount(sb: Client) {
    return unwrap<ConnectAccount | null>(sb.from('connect_accounts').select('account_id,details_submitted,payouts_enabled').maybeSingle());
  },
  requestPayout(sb: Client, v: { method: 'stripe' | 'usdt'; amountCents: number; network?: CryptoNetwork | null; address?: string | null; confirmed: boolean }) {
    return unwrap<Payout>(
      sb.rpc('request_payout', {
        p_method: v.method,
        p_amount_cents: v.amountCents,
        p_network: v.network ?? null,
        p_address: v.address ?? null,
        p_confirmed: v.confirmed,
      }),
    );
  },
  payouts(sb: Client) {
    return unwrap<Payout[]>(sb.from('payouts').select('*').order('created_at', { ascending: false }).limit(100));
  },
  cryptoAddresses(sb: Client) {
    return unwrap<CryptoAddress[]>(sb.from('crypto_addresses').select('id,network,address,label').order('created_at', { ascending: false }));
  },
  saveCryptoAddress(sb: Client, network: CryptoNetwork, address: string, label?: string) {
    return unwrap<CryptoAddress>(sb.from('crypto_addresses').insert({ network, address: address.trim(), label: label || null }).select().single());
  },
  removeCryptoAddress(sb: Client, id: string) {
    return unwrap<null>(sb.from('crypto_addresses').delete().eq('id', id));
  },

  // ----- Подписка -----
  subscription(sb: Client) {
    return unwrap<Subscription | null>(sb.from('subscriptions').select('*').maybeSingle());
  },
  subscribe(sb: Client, interval: 'month' | 'year', returnUrl: string) {
    return invoke<{ url: string }>(sb, { action: 'subscribe', interval, success_url: `${returnUrl}?payment=success`, cancel_url: returnUrl });
  },
  portal(sb: Client, returnUrl: string) {
    return invoke<{ url: string }>(sb, { action: 'portal', return_url: returnUrl });
  },

  // ----- Возвраты и квитанции -----
  requestRefund(sb: Client, v: { paymentId?: string | null; ledgerTx?: string | null; reason: RefundRequest['reason']; amountCents: number; details: string }) {
    return unwrap<RefundRequest>(
      sb.rpc('request_refund', {
        p_payment: v.paymentId ?? null,
        p_ledger_tx: v.ledgerTx ?? null,
        p_reason: v.reason,
        p_amount_cents: v.amountCents,
        p_details: v.details,
      }),
    );
  },
  refunds(sb: Client) {
    return unwrap<RefundRequest[]>(sb.from('refund_requests').select('*').order('created_at', { ascending: false }));
  },
  receipt(sb: Client, tx: string) {
    return unwrap<Receipt>(sb.rpc('receipt', { p_tx: tx }));
  },

  // ----- Курсы -----
  rates(sb: Client) {
    return unwrap<FxRate[]>(sb.from('fx_rates').select('*'));
  },
  async refreshRates(sb: Client) {
    const { error } = await sb.functions.invoke('fx-rates', { body: {} });
    if (error) throw new ApiError('errors.network');
  },
};
