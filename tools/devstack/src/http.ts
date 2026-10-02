import type { IncomingMessage, ServerResponse } from 'node:http';
import { verify } from './jwt.ts';
import type { Claims } from './db.ts';

export interface Req {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage['headers'];
  raw: Buffer;
  json<T = unknown>(): T;
  claims: Claims;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.message ?? body.msg ?? status));
  }
}

export async function readRequest(req: IncomingMessage): Promise<Req> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url ?? '/', 'http://localhost');
  return {
    method: req.method ?? 'GET',
    path: url.pathname,
    query: url.searchParams,
    headers: req.headers,
    raw,
    json<T>() {
      return (raw.length ? JSON.parse(raw.toString('utf8')) : {}) as T;
    },
    claims: claimsFrom(req.headers),
  };
}

/** Роль запроса — из Authorization (пользовательский JWT) или apikey (anon/service) */
function claimsFrom(headers: IncomingMessage['headers']): Claims {
  const bearer = headers.authorization?.replace(/^Bearer\s+/i, '');
  const key = (headers.apikey as string | undefined) ?? undefined;
  for (const token of [bearer, key]) {
    if (!token) continue;
    const payload = verify(token);
    if (payload && typeof payload.role === 'string') return payload as Claims;
  }
  return { role: 'anon' };
}

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-upsert, cache-control, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'access-control-expose-headers': 'content-range, x-supabase-api-version',
};

export function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  const isBuffer = Buffer.isBuffer(body);
  res.writeHead(status, {
    ...CORS_HEADERS,
    ...(body === undefined || isBuffer ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    ...headers,
  });
  if (body === undefined) res.end();
  else res.end(isBuffer ? body : JSON.stringify(body));
}
