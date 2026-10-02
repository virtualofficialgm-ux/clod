// IPN NOWPayments (verify_jwt = false): подпись x-nowpayments-sig, секрет NOWPAYMENTS_IPN_SECRET.
import { paymentsDb, paymentsEnv, serviceClient } from '../_shared/service.ts';
import { handleNowPaymentsIpn, PaymentsError } from '../payments/handler.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  try {
    const body = await req.json();
    const r = await handleNowPaymentsIpn(paymentsEnv(), paymentsDb(serviceClient()), body, req.headers.get('x-nowpayments-sig'));
    return Response.json(r);
  } catch (e) {
    if (e instanceof PaymentsError) return Response.json({ error: e.code }, { status: e.status });
    console.error(e);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
});
