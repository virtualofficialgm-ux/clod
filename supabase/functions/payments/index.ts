// Supabase Edge Function (Deno): пополнение, Stripe Connect, подписка, портал, выплаты и возвраты (модератор).
// Секреты: STRIPE_SECRET_KEY, NOWPAYMENTS_API_KEY. JWT пользователя проверяет платформа (verify_jwt = true).
import { corsHeaders } from '../_shared/cors.ts';
import { paymentsDb, paymentsEnv, serviceClient } from '../_shared/service.ts';
import { StripeError } from '../_shared/stripe.ts';
import { handleAction, PaymentsError } from './handler.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = serviceClient();
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return json(401, { error: 'not_authenticated' });
  try {
    const result = await handleAction(paymentsEnv(), paymentsDb(sb), { id: data.user.id, email: data.user.email }, await req.json());
    return json(200, result);
  } catch (e) {
    if (e instanceof PaymentsError) return json(e.status, { error: e.code });
    if (e instanceof StripeError) return json(502, { error: 'provider_error', message: e.message });
    const msg = (e as Error).message ?? '';
    const code = /^([a-z_]+)/.exec(msg)?.[1];
    return json(400, { error: code ?? 'internal' });
  }
});
