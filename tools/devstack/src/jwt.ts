import { createHmac, timingSafeEqual } from 'node:crypto';

/** Секрет как у `supabase start` по умолчанию — только для локальной разработки */
export const JWT_SECRET = process.env.DEVSTACK_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function sign(payload: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verify(token: string): Record<string, unknown> | null {
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
  if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;
  return payload;
}

const FAR_FUTURE = 1983812996;
export const ANON_KEY = sign({ iss: 'supabase-demo', role: 'anon', exp: FAR_FUTURE });
export const SERVICE_KEY = sign({ iss: 'supabase-demo', role: 'service_role', exp: FAR_FUTURE });
