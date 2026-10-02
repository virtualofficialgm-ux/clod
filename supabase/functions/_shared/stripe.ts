/**
 * Минимальный клиент Stripe API без SDK: form-encoded запросы через fetch и проверка подписи вебхука
 * через WebCrypto. Работает одинаково в Deno (Edge Functions) и Node (тесты, devstack).
 */

export interface StripeRequestOptions {
  idempotencyKey?: string;
  /** Запрос от имени подключённого аккаунта (Connect) */
  stripeAccount?: string;
}

export interface StripeApi {
  post<T = Record<string, any>>(path: string, params?: Record<string, unknown>, opts?: StripeRequestOptions): Promise<T>;
  get<T = Record<string, any>>(path: string, opts?: StripeRequestOptions): Promise<T>;
}

export class StripeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Вложенные параметры в формате Stripe: a[b][0][c]=1 */
export function encodeForm(params: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') out.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === 'object') {
      out.push(...encodeForm(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export function createStripeApi(secretKey: string, base = 'https://api.stripe.com', fetchImpl: typeof fetch = fetch): StripeApi {
  const request = async <T>(method: string, path: string, params?: Record<string, unknown>, opts: StripeRequestOptions = {}) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Stripe-Version': '2025-09-30.clover',
    };
    if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    if (opts.stripeAccount) headers['Stripe-Account'] = opts.stripeAccount;
    const res = await fetchImpl(`${base}${path}`, { method, headers, body: params ? encodeForm(params).join('&') : undefined });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      const err = body.error ?? {};
      throw new StripeError(res.status, String(err.code ?? err.type ?? 'stripe_error'), String(err.message ?? res.statusText));
    }
    return body as T;
  };
  return {
    post: (path, params = {}, opts) => request('POST', path, params, opts),
    get: (path, opts) => request('GET', path, undefined, opts),
  };
}

const enc = new TextEncoder();

async function hmacHex(algo: 'SHA-256' | 'SHA-512', secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: algo }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Сравнение без утечки времени */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Подпись вебхука Stripe: заголовок Stripe-Signature «t=…,v1=…» */
export async function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${timestamp},v1=${await hmacHex('SHA-256', secret, `${timestamp}.${payload}`)}`;
}

export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  const v1s = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3));
  if (!Number.isFinite(t) || !v1s.length || Math.abs(now - t) > toleranceSec) return false;
  const expected = await hmacHex('SHA-256', secret, `${t}.${payload}`);
  return v1s.some((v) => safeEqual(v, expected));
}

/** Подпись IPN NOWPayments: HMAC-SHA512 от JSON с отсортированными ключами */
export function sortedJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sort(value));
}

export async function signNowPayments(body: unknown, secret: string): Promise<string> {
  return hmacHex('SHA-512', secret, sortedJson(body));
}

export async function verifyNowPayments(body: unknown, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  return safeEqual(header.toLowerCase(), await signNowPayments(body, secret));
}
