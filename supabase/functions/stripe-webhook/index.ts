// Вебхук Stripe (verify_jwt = false): подпись проверяется секретом STRIPE_WEBHOOK_SECRET.
// Баланс и тариф меняются только здесь — после подтверждения от Stripe.
import { paymentsDb, paymentsEnv, serviceClient } from '../_shared/service.ts';
import { handleStripeWebhook, PaymentsError } from '../payments/handler.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const raw = await req.text();
  try {
    const r = await handleStripeWebhook(paymentsEnv(), paymentsDb(serviceClient()), raw, req.headers.get('Stripe-Signature'));
    return Response.json(r);
  } catch (e) {
    if (e instanceof PaymentsError) return Response.json({ error: e.code }, { status: e.status });
    console.error(e);
    // 500 → Stripe повторит доставку; повтор безопасен (идемпотентность по id события)
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
