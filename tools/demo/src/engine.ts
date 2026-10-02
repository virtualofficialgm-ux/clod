/**
 * Parri demo engine: подмножество Supabase (Auth, REST/RPC, Storage, Functions),
 * работающее прямо во вкладке поверх PGlite. Это порт tools/devstack без Node:
 * те же миграции, те же RLS-политики и денежные функции, запросы идут от ролей anon/authenticated.
 * Приложение подключается через supabase-js с подменённым fetch (window.__parriFetch).
 */
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { ComposeError, offlineDraft, validateInput } from '../../../supabase/functions/ai-compose/handler.ts';
import { BotError, handleBot, type BotTask } from '../../../supabase/functions/parri-bot/handler.ts';
import { handleAction, handleStripeWebhook, PaymentsError, type PaymentsDb, type PaymentsEnv } from '../../../supabase/functions/payments/handler.ts';
import { TranslateError, translate } from '../../../supabase/functions/translate/handler.ts';
import { createFakeStripe } from '../../devstack/src/fakeStripe.ts';

export const DEMO_URL = 'https://parri.demo';

type Role = 'anon' | 'authenticated' | 'service_role';
interface Claims {
  role: Role;
  sub?: string;
  [k: string]: unknown;
}
type Row = Record<string, any>;

class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.message ?? body.msg ?? status));
  }
}

// ---------- JWT (HS256 на WebCrypto) ----------
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s: string) => b64url(enc.encode(s));
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
let hmacKey: CryptoKey | null = null;
async function key() {
  hmacKey ??= await crypto.subtle.importKey('raw', enc.encode('parri-demo-secret-only-in-this-browser-tab'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return hmacKey;
}
async function sign(payload: Record<string, unknown>) {
  const data = `${b64urlText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64urlText(JSON.stringify(payload))}`;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}
async function verify(token: string): Promise<Record<string, unknown> | null> {
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(s), enc.encode(`${h}.${b}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(b)));
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
export async function anonKey() {
  return sign({ iss: 'parri-demo', role: 'anon', exp: 1983812996 });
}

// ---------- База ----------
let db: PGlite;

async function sys<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function withRole<T>(claims: Claims, fn: (q: (sql: string, p?: unknown[]) => Promise<Row[]>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: Transaction) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const role = claims.role === 'service_role' ? 'service_role' : claims.role === 'authenticated' ? 'authenticated' : 'anon';
    await tx.exec(`set local role ${role}`);
    return fn(async (sql, p = []) => (await tx.query<Row>(sql, p)).rows);
  });
}

export async function startEngine(opts: {
  pgliteWasmModule: WebAssembly.Module;
  initdbWasmModule: WebAssembly.Module;
  fsBundle: Blob;
  bootstrapSql: () => Promise<string>;
  dataDir: string;
  onProgress?: (text: string) => void;
}) {
  db = new PGlite({
    dataDir: opts.dataDir,
    pgliteWasmModule: opts.pgliteWasmModule,
    initdbWasmModule: opts.initdbWasmModule,
    fsBundle: opts.fsBundle,
    relaxedDurability: true,
    parsers: { 20: (v: string) => Number(v), 1700: (v: string) => Number(v) },
  });
  await db.waitReady;
  await db.exec(`set search_path = "$user", public, extensions;`);
  const ready = await sys<{ ok: boolean }>(`select to_regclass('public.tasks') is not null as ok`);
  if (!ready[0]?.ok) {
    opts.onProgress?.('Создаём базу: миграции, RLS и демо-данные…');
    await db.exec(await opts.bootstrapSql());
    await db.exec(`select set_config('request.jwt.claims', '', false); reset role; set search_path = "$user", public, extensions;`);
  }
}

// ---------- Auth ----------
interface UserRow {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  raw_user_meta_data: Record<string, unknown>;
  raw_app_meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

const userJson = (u: UserRow) => ({
  id: u.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: u.email,
  email_confirmed_at: u.email_confirmed_at,
  confirmed_at: u.email_confirmed_at,
  phone: '',
  last_sign_in_at: u.last_sign_in_at,
  app_metadata: u.raw_app_meta_data,
  user_metadata: u.raw_user_meta_data,
  identities: [],
  created_at: u.created_at,
  updated_at: u.updated_at,
  is_anonymous: false,
});

const findUser = async (email: string) => (await sys<UserRow>(`select * from auth.users where lower(email) = lower($1)`, [email]))[0] ?? null;
async function getUser(id: string) {
  const u = (await sys<UserRow>(`select * from auth.users where id = $1`, [id]))[0];
  if (!u) throw new HttpError(404, { code: 'user_not_found', msg: 'User not found' });
  return u;
}

function randomToken(n = 24) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

async function issueSession(user: UserRow) {
  await sys(`update auth.users set last_sign_in_at = now() where id = $1`, [user.id]);
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomToken();
  await sys(`insert into devstack.refresh_tokens (token, user_id) values ($1, $2)`, [refresh, user.id]);
  const fresh = await getUser(user.id);
  return {
    access_token: await sign({
      aud: 'authenticated', sub: user.id, email: user.email, role: 'authenticated', iat: now, exp: now + 3600,
      session_id: crypto.randomUUID(), app_metadata: user.raw_app_meta_data, user_metadata: user.raw_user_meta_data,
    }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refresh,
    user: userJson(fresh),
  };
}

async function issueOtp(email: string, type: string) {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
  await sys(`insert into devstack.otps (email, type, code) values (lower($1), $2, $3)`, [email, type, code]);
  // Писем в демо нет — код показывает оболочка страницы
  window.dispatchEvent(new CustomEvent('parri-demo-otp', { detail: { email, code, type } }));
}

async function consumeOtp(email: string, types: string[], code: string) {
  const r = await sys(
    `update devstack.otps set used_at = now()
      where id = (select id from devstack.otps where email = lower($1) and type = any($2::text[]) and code = $3
                    and used_at is null and created_at > now() - interval '1 hour' order by id desc limit 1)
      returning id`,
    [email, types, code],
  );
  return r.length === 1;
}

const authErr = (code: string, msg: string, status = 400) => new HttpError(status, { code, error_code: code, msg });

async function handleAuth(method: string, sub: string, query: URLSearchParams, body: any, claims: Claims) {
  switch (`${method} ${sub}`) {
    case 'GET /settings':
      return { status: 200, body: { external: { email: true }, disable_signup: false, mailer_autoconfirm: false } };
    case 'POST /signup': {
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw authErr('validation_failed', 'Invalid email');
      if (password.length < 8) throw authErr('weak_password', 'Password should be at least 8 characters', 422);
      let user = await findUser(email);
      if (user?.email_confirmed_at) return { status: 200, body: userJson(user) };
      if (!user) {
        user = (
          await sys<UserRow>(
            `insert into auth.users (instance_id, email, encrypted_password, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
             values ('00000000-0000-0000-0000-000000000000', lower($1), extensions.crypt($2, extensions.gen_salt('bf')), $3, '', '', '', '') returning *`,
            [email, password, JSON.stringify(body.data ?? {})],
          )
        )[0]!;
      } else {
        await sys(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1`, [user.id, password]);
      }
      await issueOtp(email, 'signup');
      return { status: 200, body: userJson(user) };
    }
    case 'POST /resend': {
      const u = await findUser(String(body.email ?? ''));
      if (u && !u.email_confirmed_at) await issueOtp(u.email, 'signup');
      return { status: 200, body: {} };
    }
    case 'POST /otp': {
      const email = String(body.email ?? '').trim();
      let u = await findUser(email);
      if (!u) {
        if (body.create_user === false) throw authErr('otp_disabled', 'Signups not allowed for otp', 422);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw authErr('validation_failed', 'Invalid email');
        u = (
          await sys<UserRow>(
            `insert into auth.users (instance_id, email, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
             values ('00000000-0000-0000-0000-000000000000', lower($1), $2, '', '', '', '') returning *`,
            [email, JSON.stringify(body.data ?? {})],
          )
        )[0]!;
      }
      await issueOtp(u.email, 'email');
      return { status: 200, body: {} };
    }
    case 'POST /recover': {
      const u = await findUser(String(body.email ?? ''));
      if (u) await issueOtp(u.email, 'recovery');
      return { status: 200, body: {} };
    }
    case 'POST /verify': {
      const email = String(body.email ?? '');
      const type = String(body.type ?? '');
      const types = type === 'signup' ? ['signup'] : type === 'recovery' ? ['recovery'] : ['email', 'signup'];
      const u = await findUser(email);
      if (!u || !(await consumeOtp(email, types, String(body.token ?? '')))) throw authErr('otp_expired', 'Token has expired or is invalid', 403);
      await sys(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1`, [u.id]);
      return { status: 200, body: await issueSession(await getUser(u.id)) };
    }
    case 'POST /token': {
      const grant = query.get('grant_type');
      if (grant === 'password') {
        const u = (
          await sys<UserRow & { ok: boolean }>(
            `select *, encrypted_password = extensions.crypt($2, encrypted_password) as ok from auth.users where lower(email) = lower($1)`,
            [String(body.email ?? ''), String(body.password ?? '')],
          )
        )[0];
        if (!u || !u.ok) throw authErr('invalid_credentials', 'Invalid login credentials');
        if (!u.email_confirmed_at) throw authErr('email_not_confirmed', 'Email not confirmed');
        return { status: 200, body: await issueSession(u) };
      }
      if (grant === 'refresh_token') {
        const r = await sys<{ user_id: string }>(
          `update devstack.refresh_tokens set revoked = true where token = $1 and not revoked returning user_id`,
          [String(body.refresh_token ?? '')],
        );
        if (!r[0]) throw authErr('refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
        return { status: 200, body: await issueSession(await getUser(r[0].user_id)) };
      }
      throw authErr('unsupported_grant_type', 'Unsupported grant type');
    }
    case 'GET /user':
      if (claims.role !== 'authenticated' || !claims.sub) throw authErr('no_authorization', 'Unauthorized', 401);
      return { status: 200, body: userJson(await getUser(claims.sub)) };
    case 'PUT /user': {
      if (claims.role !== 'authenticated' || !claims.sub) throw authErr('no_authorization', 'Unauthorized', 401);
      if (body.password !== undefined) {
        if (String(body.password).length < 8) throw authErr('weak_password', 'Password should be at least 8 characters', 422);
        await sys(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`, [claims.sub, String(body.password)]);
      }
      if (body.data) await sys(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [claims.sub, JSON.stringify(body.data)]);
      return { status: 200, body: userJson(await getUser(claims.sub)) };
    }
    case 'POST /logout':
      if (claims.sub) await sys(`update devstack.refresh_tokens set revoked = true where user_id = $1`, [claims.sub]);
      return { status: 204 };
  }
  throw new HttpError(404, { code: 'not_found', msg: `demo: ${method} /auth/v1${sub}` });
}

// ---------- REST (подмножество PostgREST) ----------
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new HttpError(400, { code: 'PGRST100', message: `bad identifier ${s}` });
  return `"${s}"`;
};
const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseList(v: string) {
  const inner = v.replace(/^\(/, '').replace(/\)$/, '');
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.length) out.push(cur);
  return out;
}

function buildWhere(query: URLSearchParams, params: unknown[]) {
  const parts: string[] = [];
  for (const [k, value] of query) {
    if (RESERVED.has(k)) continue;
    const col = ident(k);
    let rest = value;
    let negate = false;
    if (rest.startsWith('not.')) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf('.');
    const op = rest.slice(0, dot);
    const arg = rest.slice(dot + 1);
    let expr: string;
    if (op === 'is') expr = `${col} is ${['null', 'true', 'false'].includes(arg.toLowerCase()) ? arg.toLowerCase() : 'null'}`;
    else if (op === 'in') {
      params.push(parseList(arg));
      expr = `${col}::text = any($${params.length}::text[])`;
    } else if (OPS[op]) {
      params.push(op === 'like' || op === 'ilike' ? arg.replace(/\*/g, '%') : arg);
      expr = `${col} ${OPS[op]} $${params.length}`;
    } else throw new HttpError(400, { code: 'PGRST100', message: `demo: operator ${op}` });
    parts.push(negate ? `not (${expr})` : expr);
  }
  return parts.length ? `where ${parts.join(' and ')}` : '';
}

function buildSelect(select: string | null) {
  if (!select || select === '*') return '*';
  return select
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      if (c === '*') return '*';
      const [alias, col] = c.includes(':') ? c.split(':') : [null, c];
      return alias ? `${ident(col!)} as ${ident(alias)}` : ident(col!);
    })
    .join(', ');
}

function buildOrder(order: string | null) {
  if (!order) return '';
  return 'order by ' + order.split(',').map((o) => {
    const [col, ...mods] = o.split('.');
    return `${ident(col!)} ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''}`;
  }).join(', ');
}

const fnCache = new Map<string, { args: { name: string; type: string }[]; retset: boolean; scalar: boolean }>();
async function fnInfo(name: string) {
  const c = fnCache.get(name);
  if (c) return c;
  const row = (
    await sys<{ names: string[] | null; types: string[]; retset: boolean; typtype: string }>(
      `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
              p.proretset as retset, rt.typtype::text as typtype
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
        where n.nspname = 'public' and p.proname = $1`,
      [name],
    )
  )[0];
  if (!row) throw new HttpError(404, { code: 'PGRST202', message: `Could not find the function public.${name}` });
  const info = { args: row.types.map((type, i) => ({ name: row.names?.[i] ?? `$${i + 1}`, type })), retset: row.retset, scalar: row.typtype !== 'c' && !row.retset };
  fnCache.set(name, info);
  return info;
}

function shape(accept: string, rows: unknown[]) {
  if (accept.includes('application/vnd.pgrst.object+json')) {
    if (rows.length !== 1) throw new HttpError(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
    return rows[0];
  }
  return rows;
}

const prefer = (h: Headers, k: string) => (h.get('prefer') ?? '').match(new RegExp(`${k}=([a-z-]+)`))?.[1];

async function handleRest(method: string, sub: string, query: URLSearchParams, headers: Headers, body: any, claims: Claims) {
  const accept = headers.get('accept') ?? '';
  if (sub.startsWith('/rpc/')) {
    const name = sub.slice(5);
    ident(name);
    const info = await fnInfo(name);
    const input: Record<string, unknown> = method === 'GET' ? Object.fromEntries(query) : body ?? {};
    const params: unknown[] = [];
    const args = info.args
      .filter((a) => a.name in input)
      .map((a) => {
        const v = input[a.name];
        params.push(a.type === 'jsonb' || a.type === 'json' ? JSON.stringify(v) : v);
        return `${ident(a.name)} => $${params.length}::${a.type}`;
      });
    const call = `public.${ident(name)}(${args.join(', ')})`;
    const result = await withRole(claims, async (q) => {
      if (info.scalar) return (await q(`select ${call} as v`, params))[0]?.v ?? null;
      const rows = await q(`select * from ${call}`, params);
      if (info.retset) return shape(accept, rows);
      const row = rows[0];
      return row && Object.values(row).every((v) => v === null) ? null : row;
    });
    return { status: 200, body: result };
  }

  const table = ident(sub.replace(/^\//, ''));
  const params: unknown[] = [];
  const returning = prefer(headers, 'return') === 'representation' ? 'returning *' : '';
  if (method === 'GET' || method === 'HEAD') {
    const where = buildWhere(query, params);
    const limit = query.get('limit');
    const offset = query.get('offset');
    const { rows, total } = await withRole(claims, async (q) => {
      const rows = await q(
        `select ${buildSelect(query.get('select'))} from public.${table} ${where} ${buildOrder(query.get('order'))} ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`,
        params,
      );
      const total = prefer(headers, 'count') ? (await q(`select count(*)::int as n from public.${table} ${where}`, params))[0]!.n : null;
      return { rows, total };
    });
    const from = Number(offset ?? 0);
    return { status: 200, body: method === 'HEAD' ? undefined : shape(accept, rows), headers: { 'content-range': `${rows.length ? `${from}-${from + rows.length - 1}` : '*'}/${total ?? '*'}` } };
  }
  if (method === 'POST') {
    const rowsIn = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rowsIn.flatMap((r: object) => Object.keys(r)))].map(ident);
    params.push(JSON.stringify(rowsIn));
    const rows = await withRole(claims, (q) =>
      q(`insert into public.${table} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::public.${table}, $1::json) ${returning}`, params),
    );
    return { status: 201, body: returning ? shape(accept, rows) : undefined };
  }
  if (method === 'PATCH') {
    const cols = Object.keys(body).map(ident);
    params.push(JSON.stringify(body));
    const where = buildWhere(query, params);
    const rows = await withRole(claims, (q) =>
      q(`update public.${table} set (${cols.join(', ')}) = (select ${cols.join(', ')} from json_populate_record(null::public.${table}, $1::json)) ${where} ${returning}`, params),
    );
    return { status: returning ? 200 : 204, body: returning ? shape(accept, rows) : undefined };
  }
  if (method === 'DELETE') {
    const where = buildWhere(query, params);
    const rows = await withRole(claims, (q) => q(`delete from public.${table} ${where} ${returning}`, params));
    return { status: returning ? 200 : 204, body: returning ? shape(accept, rows) : undefined };
  }
  throw new HttpError(405, { code: 'PGRST000', message: 'method not allowed' });
}

// ---------- Storage ----------
function splitPath(rest: string) {
  const d = decodeURIComponent(rest);
  const i = d.indexOf('/');
  if (i < 1) throw new HttpError(400, { error: 'InvalidKey', message: 'bad path' });
  return { bucket: d.slice(0, i), name: d.slice(i + 1) };
}

async function canRead(claims: Claims, bucket: string, name: string) {
  return withRole(claims, async (q) => (await q(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])).length === 1);
}

async function serveFile(bucket: string, name: string) {
  const f = (await sys<{ data: Uint8Array; mime: string }>(`select data, mime from devstack.files where bucket = $1 and name = $2`, [bucket, name]))[0];
  if (!f) throw new HttpError(404, { error: 'not_found', message: 'Object not found' });
  return { status: 200, body: f.data, headers: { 'content-type': f.mime } };
}

async function handleStorage(method: string, sub: string, query: URLSearchParams, headers: Headers, raw: ArrayBuffer, claims: Claims) {
  if (method === 'GET' && sub.startsWith('/object/public/')) {
    const { bucket, name } = splitPath(sub.slice('/object/public/'.length));
    return serveFile(bucket, name);
  }
  if (sub.startsWith('/object/sign/')) {
    const { bucket, name } = splitPath(sub.slice('/object/sign/'.length));
    if (method === 'POST') {
      if (!(await canRead(claims, bucket, name))) throw new HttpError(400, { error: 'not_found', message: 'Object not found', statusCode: '404' });
      const token = await sign({ url: `${bucket}/${name}`, exp: Math.floor(Date.now() / 1000) + 3600 });
      return { status: 200, body: { signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${token}` } };
    }
    const payload = await verify(query.get('token') ?? '');
    if (!payload || payload.url !== `${bucket}/${name}`) throw new HttpError(400, { error: 'InvalidJWT', message: 'invalid signature' });
    return serveFile(bucket, name);
  }
  if (sub.startsWith('/object/')) {
    let rest = sub.slice('/object/'.length);
    if (rest.startsWith('authenticated/')) rest = rest.slice('authenticated/'.length);
    if (method === 'DELETE' && !rest.includes('/')) {
      const bucket = decodeURIComponent(rest);
      const { prefixes = [] } = JSON.parse(new TextDecoder().decode(raw) || '{}');
      const deleted = await withRole(claims, (q) => q(`delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name`, [bucket, prefixes]));
      for (const d of deleted) await sys(`delete from devstack.files where bucket = $1 and name = $2`, [bucket, d.name]);
      return { status: 200, body: deleted };
    }
    const { bucket, name } = splitPath(rest);
    if (method === 'GET') {
      if (!(await canRead(claims, bucket, name))) throw new HttpError(400, { error: 'not_found', message: 'Object not found', statusCode: '404' });
      return serveFile(bucket, name);
    }
    if (method === 'POST' || method === 'PUT') {
      let data = new Uint8Array(raw);
      let mime = headers.get('content-type') ?? 'application/octet-stream';
      if (mime.startsWith('multipart/form-data')) {
        const form = await new Request('https://x', { method: 'POST', headers: { 'content-type': mime }, body: raw }).formData();
        for (const [, v] of form) {
          if (typeof v !== 'string') {
            data = new Uint8Array(await v.arrayBuffer());
            mime = v.type || 'application/octet-stream';
          }
        }
      }
      if (data.length > 52428800) throw new HttpError(413, { error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
      try {
        const row = await withRole(claims, async (q) =>
          (await q(`insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3) returning id`, [bucket, name, JSON.stringify({ size: data.length, mimetype: mime })]))[0]!,
        );
        await sys(`insert into devstack.files (bucket, name, data, mime) values ($1, $2, $3, $4) on conflict (bucket, name) do update set data = excluded.data, mime = excluded.mime`, [bucket, name, data, mime]);
        return { status: 200, body: { Key: `${bucket}/${name}`, Id: row.id, id: row.id, path: name, fullPath: `${bucket}/${name}` } };
      } catch (e) {
        const err = e as { code?: string };
        if (err.code === '23505') throw new HttpError(409, { error: 'Duplicate', message: 'The resource already exists', statusCode: '409' });
        if (err.code === '42501') throw new HttpError(403, { error: 'Unauthorized', message: 'new row violates row-level security policy', statusCode: '403' });
        throw e;
      }
    }
  }
  throw new HttpError(404, { error: 'not_found', message: `demo: ${method} /storage/v1${sub}` });
}

// ---------- Функции: бот, перевод, деньги ----------
async function botAction(claims: Claims, body: any) {
  return handleBot(
    body?.message,
    {
      log: (role, text, tasks) => withRole(claims, (q) => q(`select public.bot_log($1, $2, $3::jsonb)`, [role, text, JSON.stringify(tasks ?? [])])).then(() => undefined),
      history: async () => ((await withRole(claims, (q) => q(`select role, body from public.bot_messages order by id desc limit 10`))) as { role: 'user' | 'assistant'; body: string }[]).reverse(),
      searchTasks: async (f) =>
        (await withRole(claims, (q) =>
          q(
            `select id, title, reward_cents::int, currency, category, deadline, kind
             from public.feed_tasks(p_kind => $1, p_query => $2, p_categories => $3::public.task_category[], p_max_reward => $4, p_max_minutes => $5, p_limit => 5)`,
            [f.kind ?? 'online', f.query ?? null, f.categories ?? null, f.maxRewardCents ?? null, f.maxMinutes ?? null],
          ),
        )) as BotTask[],
    },
    null,
  );
}

// Сервисные вызовы денег — от владельца базы (как service_role в продакшене)
const PAY_TABLES = new Set(['payments', 'payouts', 'refund_requests', 'stripe_customers', 'connect_accounts', 'subscriptions', 'profiles']);
const payDb: PaymentsDb = {
  async rpc(fn, args) {
    if (!/^[a-z_]+$/.test(fn)) throw new Error('bad function name');
    const keys = Object.keys(args);
    const values = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
    const rows = await sys(`select to_jsonb(public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})) as r`, values);
    return rows[0]?.r as any;
  },
  async one(table, match) {
    if (!PAY_TABLES.has(table)) throw new Error('bad table');
    const keys = Object.keys(match);
    const where = keys.map((k, i) => `${k.replace(/[^a-z_]/g, '')} = $${i + 1}`).join(' and ');
    const rows = await sys(`select to_jsonb(t) as r from public.${table} t where ${where} limit 1`, keys.map((k) => match[k]));
    return (rows[0]?.r ?? null) as any;
  },
};
const WEBHOOK_SECRET = 'whsec_parri_demo';
const payEnv: PaymentsEnv = { stripe: null, stripeWebhookSecret: WEBHOOK_SECRET, nowpayments: null, nowpaymentsIpnSecret: null };
const fakeStripe = createFakeStripe({
  webhookSecret: WEBHOOK_SECRET,
  pagesBase: DEMO_URL,
  deliver: async (raw, sig) => {
    await handleStripeWebhook(payEnv, payDb, raw, sig);
  },
});
payEnv.stripe = fakeStripe.api;

// ---------- Маршрутизация ----------
function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  const err = e as { code?: string; message?: string; detail?: string; hint?: string };
  const status = err.code === '42501' ? (String(err.message).includes('row-level security') ? 403 : 401) : err.code === '23505' ? 409 : err.code === 'P0002' ? 404 : 400;
  return new HttpError(status, { code: err.code ?? 'PGRST000', message: err.message ?? 'error', details: err.detail ?? null, hint: err.hint ?? null });
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };

function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const isBytes = body instanceof Uint8Array;
  const payload = body === undefined || status === 204 ? null : isBytes ? (body as Uint8Array) : JSON.stringify(body);
  return new Response(payload as BodyInit | null, {
    status,
    headers: { ...CORS, ...(isBytes || body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }), ...headers },
  });
}

async function claimsOf(headers: Headers): Promise<Claims> {
  for (const token of [headers.get('authorization')?.replace(/^Bearer\s+/i, ''), headers.get('apikey')]) {
    if (!token) continue;
    const p = await verify(token);
    if (p && typeof p.role === 'string') return p as Claims;
  }
  return { role: 'anon' };
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin !== DEMO_URL) return fetch(input, init);
  try {
    const method = req.method.toUpperCase();
    const raw = method === 'GET' || method === 'HEAD' ? new ArrayBuffer(0) : await req.arrayBuffer();
    const text = () => new TextDecoder().decode(raw);
    const json = () => (raw.byteLength ? JSON.parse(text()) : {});
    const claims = await claimsOf(req.headers);
    const path = url.pathname;
    let r: { status: number; body?: unknown; headers?: Record<string, string> };
    if (path.startsWith('/auth/v1')) r = await handleAuth(method, path.slice(8) || '/', url.searchParams, method === 'GET' ? {} : json(), claims);
    else if (path.startsWith('/rest/v1')) r = await handleRest(method, path.slice(8), url.searchParams, req.headers, method === 'GET' || method === 'HEAD' ? null : json(), claims);
    else if (path.startsWith('/storage/v1')) r = await handleStorage(method, path.slice(11), url.searchParams, req.headers, raw, claims);
    else if (path === '/functions/v1/ai-compose') {
      if (claims.role !== 'authenticated') return respond(401, { error: 'unauthorized' });
      try {
        r = { status: 200, body: offlineDraft(validateInput(json())) };
      } catch (e) {
        if (e instanceof ComposeError) return respond(400, { error: e.code });
        throw e;
      }
    } else if (path === '/functions/v1/parri-bot') {
      if (claims.role !== 'authenticated' || !claims.sub) return respond(401, { error: 'not_authenticated' });
      try {
        r = { status: 200, body: await botAction(claims, json()) };
      } catch (e) {
        if (e instanceof BotError) return respond(e.code === 'invalid_input' ? 400 : e.code === 'bot_requires_pro' ? 403 : 502, { error: e.code });
        throw e;
      }
    } else if (path === '/functions/v1/translate') {
      if (claims.role !== 'authenticated') return respond(401, { error: 'unauthorized' });
      try {
        r = { status: 200, body: await translate(null, json()) };
      } catch (e) {
        if (e instanceof TranslateError) return respond(e.code === 'invalid_input' ? 400 : 503, { error: e.code });
        throw e;
      }
    } else if (path === '/functions/v1/payments') {
      if (claims.role !== 'authenticated' || !claims.sub) return respond(401, { error: 'not_authenticated' });
      try {
        const email = (await sys<{ email: string }>(`select email from auth.users where id = $1`, [claims.sub]))[0]?.email;
        r = { status: 200, body: (await handleAction(payEnv, payDb, { id: claims.sub, email }, json())) ?? null };
      } catch (e) {
        if (e instanceof PaymentsError) return respond(e.status, { error: e.code });
        const code = /^([a-z_]+)/.exec((e as Error).message ?? '')?.[1];
        return respond(400, { error: code ?? 'internal', message: (e as Error).message });
      }
    } else if (path === '/functions/v1/fx-rates') {
      r = { status: 200, body: { updated: 0 } };
    } else if (path.startsWith('/dev/stripe/')) {
      // Тестовые страницы Stripe: шелл демо показывает их поверх приложения (JSON вместо редиректа)
      const form = new URLSearchParams(method === 'POST' ? text() : '');
      for (const [k, v] of url.searchParams) form.set(k, v);
      const page = await fakeStripe.page(method, path, form);
      r = page ? { status: 200, body: { html: page.html ?? null, redirect: page.redirect ?? null } } : { status: 404, body: { message: 'not found' } };
    } else r = { status: 404, body: { message: `demo: ${path}` } };
    return respond(r.status, r.body, r.headers);
  } catch (e) {
    const h = toHttpError(e);
    return respond(h.status, h.body);
  }
}
