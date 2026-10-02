import { createServer } from 'node:http';
import { handleAuth, lastOtp } from './auth.ts';
import { ensureDevstackSchema } from './db.ts';
import { HttpError, readRequest, send } from './http.ts';
import { ANON_KEY, SERVICE_KEY } from './jwt.ts';
import { handleRest } from './rest.ts';
import { handleStorage } from './storage.ts';
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
});
