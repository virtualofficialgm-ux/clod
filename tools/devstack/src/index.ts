import { createServer } from 'node:http';
import { handleAuth, lastOtp } from './auth.ts';
import { ensureDevstackSchema } from './db.ts';
import { HttpError, readRequest, send } from './http.ts';
import { ANON_KEY, SERVICE_KEY } from './jwt.ts';
import { handleRest } from './rest.ts';
import { BotError, botAction } from './bot.ts';
import type { ToolClient } from '../../../supabase/functions/parri-bot/handler.ts';
import { handleStorage } from './storage.ts';
import { cryptoWebhook, fakeStripe, nowPaymentsPage, paymentsAction, refreshRates, stripeWebhook } from './payments.ts';
import { PaymentsError } from '../../../supabase/functions/payments/handler.ts';
import {
  ComposeError,
  composeTask,
  offlineDraft,
  validateInput,
  type MessagesClient,
} from '../../../supabase/functions/ai-compose/handler.ts';

/**
 * Parri devstack — локальная замена шлюза Supabase для проверки без Docker.
 * НЕ для продакшена. В настоящей разработке используйте `supabase start`.
 */
const PORT = Number(process.env.DEVSTACK_PORT ?? 54321);

let claude: MessagesClient | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  claude = new Anthropic() as unknown as MessagesClient;
}

await ensureDevstackSchema();

const server = createServer(async (rawReq, res) => {
  if (rawReq.method === 'OPTIONS') return send(res, 204);
  try {
    const req = await readRequest(rawReq);
    const route = (prefix: string) => (req.path.startsWith(prefix) ? req.path.slice(prefix.length) || '/' : null);

    let sub: string | null;
    if ((sub = route('/auth/v1'))) {
      const r = await handleAuth(req, sub);
      return send(res, r.status, r.body);
    }
    if ((sub = route('/rest/v1'))) {
      const r = await handleRest(req, sub);
      return send(res, r.status, r.body, r.headers);
    }
    if ((sub = route('/storage/v1'))) {
      const r = await handleStorage(req, sub);
      return send(res, r.status, r.body, r.headers);
    }
    if (req.path === '/functions/v1/ai-compose' && req.method === 'POST') {
      if (req.claims.role !== 'authenticated') return send(res, 401, { error: 'unauthorized' });
      try {
        const input = validateInput(req.json());
        return send(res, 200, claude ? await composeTask(claude, input) : offlineDraft(input));
      } catch (e) {
        if (e instanceof ComposeError) return send(res, e.code === 'invalid_input' ? 400 : 502, { error: e.code });
        throw e;
      }
    }
    if (req.path === '/functions/v1/parri-bot' && req.method === 'POST') {
      if (req.claims.role !== 'authenticated' || !req.claims.sub) return send(res, 401, { error: 'not_authenticated' });
      try {
        return send(res, 200, await botAction(req.claims, req.json(), claude as unknown as ToolClient | null));
      } catch (e) {
        if (e instanceof BotError) return send(res, e.code === 'invalid_input' ? 400 : e.code === 'bot_requires_pro' ? 403 : 502, { error: e.code });
        throw e;
      }
    }
    if (req.path === '/functions/v1/payments' && req.method === 'POST') {
      if (req.claims.role !== 'authenticated' || !req.claims.sub) return send(res, 401, { error: 'not_authenticated' });
      try {
        return send(res, 200, await paymentsAction(req.claims.sub, req.json()));
      } catch (e) {
        if (e instanceof PaymentsError) return send(res, e.status, { error: e.code });
        const code = /^([a-z_]+)/.exec((e as Error).message ?? '')?.[1];
        return send(res, 400, { error: code ?? 'internal', message: (e as Error).message });
      }
    }
    if (req.path === '/functions/v1/stripe-webhook' && req.method === 'POST') {
      try {
        return send(res, 200, await stripeWebhook(req.raw.toString('utf8'), (req.headers['stripe-signature'] as string) ?? null));
      } catch (e) {
        if (e instanceof PaymentsError) return send(res, e.status, { error: e.code });
        throw e;
      }
    }
    if (req.path === '/functions/v1/crypto-webhook' && req.method === 'POST') {
      try {
        return send(res, 200, await cryptoWebhook(req.json(), (req.headers['x-nowpayments-sig'] as string) ?? null));
      } catch (e) {
        if (e instanceof PaymentsError) return send(res, e.status, { error: e.code });
        throw e;
      }
    }
    if (req.path === '/functions/v1/fx-rates') return send(res, 200, { updated: await refreshRates() });
    if (req.path.startsWith('/dev/stripe/') && fakeStripe) {
      const form = new URLSearchParams(req.method === 'POST' ? req.raw.toString('utf8') : '');
      for (const [k, v] of req.query) form.set(k, v);
      const page = await fakeStripe.page(req.method, req.path, form);
      if (page?.redirect) return send(res, 303, undefined, { location: page.redirect });
      if (page) return send(res, page.status, Buffer.from(page.html ?? ''), { 'content-type': 'text/html; charset=utf-8' });
    }
    if (req.path.startsWith('/dev/nowpayments/')) {
      const page = await nowPaymentsPage(req.method, req.path.split('/').pop()!);
      return send(res, page.status, Buffer.from(page.html ?? ''), { 'content-type': 'text/html; charset=utf-8' });
    }
    if (req.path === '/dev/otp') {
      return send(res, 200, { code: await lastOtp(req.query.get('email') ?? '') });
    }
    if (req.path === '/dev/health') return send(res, 200, { ok: true });
    return send(res, 404, { message: `devstack: ${req.method} ${req.path} не поддерживается` });
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, e.body);
    console.error(e);
    return send(res, 500, { message: (e as Error).message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[devstack] http://127.0.0.1:${PORT}`);
  console.log(`[devstack] anon key:    ${ANON_KEY}`);
  console.log(`[devstack] service key: ${SERVICE_KEY}`);
  console.log(`[devstack] Claude: ${claude ? 'ANTHROPIC_API_KEY задан' : 'офлайн-черновик (ключа нет)'}`);
  console.log(`[devstack] Stripe: ${fakeStripe ? 'тестовые страницы оплаты /dev/stripe/* (ключа нет)' : 'STRIPE_SECRET_KEY задан'}`);
});
