// Общие части Edge Functions для денег (Deno): сервисный клиент базы и окружение провайдеров.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@^2.117.2';
import type { NowPaymentsApi, PaymentsDb, PaymentsEnv } from '../payments/handler.ts';
import { createStripeApi } from './stripe.ts';

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export function paymentsDb(sb: SupabaseClient): PaymentsDb {
  return {
    async rpc(fn, args) {
      const { data, error } = await sb.rpc(fn, args);
      if (error) throw new Error(error.message);
      return data;
    },
    async one(table, match) {
      const { data, error } = await sb.from(table).select('*').match(match).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  };
}

function nowPayments(apiKey: string): NowPaymentsApi {
  return {
    async createPayment(p) {
      const res = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error(`nowpayments ${res.status}`);
      return res.json();
    },
  };
}

/** Ключи — только в секретах функций (supabase secrets set ...). Без ключа соответствующий способ недоступен. */
export function paymentsEnv(): PaymentsEnv {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const npKey = Deno.env.get('NOWPAYMENTS_API_KEY');
  return {
    stripe: stripeKey ? createStripeApi(stripeKey) : null,
    stripeWebhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? null,
    nowpayments: npKey ? nowPayments(npKey) : null,
    nowpaymentsIpnSecret: Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? null,
    functionsUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1`,
  };
}
