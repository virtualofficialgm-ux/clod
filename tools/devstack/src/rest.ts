import type pg from 'pg';
import { pool, withRole } from './db.ts';
import { HttpError, type Req } from './http.ts';

/**
 * Подмножество PostgREST (/rest/v1):
 *  - GET/POST/PATCH/DELETE по таблицам public: select=список колонок, фильтры
 *    eq/neq/gt/gte/lt/lte/like/ilike/is/in, order, limit, offset, Prefer: count=exact|return=representation
 *  - POST /rpc/<fn> с именованными аргументами
 * Вложенные select (embedding) не поддерживаются — клиентский код их не использует.
 */

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new HttpError(400, { code: 'PGRST100', message: `bad identifier ${s}` });
  return `"${s}"`;
};

const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseList(v: string): string[] {
  // in.(a,b,"c,d")
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

function buildWhere(query: URLSearchParams, params: unknown[]): string {
  const parts: string[] = [];
  for (const [key, value] of query) {
    if (RESERVED.has(key)) continue;
    const col = ident(key);
    let negate = false;
    let rest = value;
    if (rest.startsWith('not.')) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf('.');
    const op = rest.slice(0, dot);
    const arg = rest.slice(dot + 1);
    let expr: string;
    if (op === 'is') {
      const v = arg.toLowerCase();
      if (!['null', 'true', 'false'].includes(v)) throw new HttpError(400, { code: 'PGRST100', message: 'bad is' });
      expr = `${col} is ${v}`;
    } else if (op === 'in') {
      params.push(parseList(arg));
      expr = `${col} = any($${params.length})`;
    } else if (OPS[op]) {
      params.push(op === 'like' || op === 'ilike' ? arg.replace(/\*/g, '%') : arg);
      expr = `${col} ${OPS[op]} $${params.length}`;
    } else {
      throw new HttpError(400, { code: 'PGRST100', message: `devstack: оператор ${op} не поддерживается` });
    }
    parts.push(negate ? `not (${expr})` : expr);
  }
  return parts.length ? `where ${parts.join(' and ')}` : '';
}

function buildSelect(select: string | null): string {
  if (!select || select === '*') return '*';
  return select
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      if (c === '*') return '*';
      if (c.includes('(')) throw new HttpError(400, { code: 'PGRST100', message: 'devstack: embedding не поддерживается' });
      const [alias, col] = c.includes(':') ? c.split(':') : [null, c];
      return alias ? `${ident(col!)} as ${ident(alias)}` : ident(col!);
    })
    .join(', ');
}

function buildOrder(order: string | null): string {
  if (!order) return '';
  const parts = order.split(',').map((o) => {
    const [col, ...mods] = o.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
    return `${ident(col!)} ${dir}${nulls}`;
  });
  return `order by ${parts.join(', ')}`;
}

function prefer(req: Req, key: string): string | undefined {
  const header = String(req.headers.prefer ?? '');
  const m = header.match(new RegExp(`${key}=([a-z-]+)`));
  return m?.[1];
}

function wantsObject(req: Req) {
  return String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
}

function pgError(e: unknown): HttpError {
  const err = e as pg.DatabaseError;
  if (e instanceof HttpError) return e;
  const status =
    err.code === '42501' ? (String(err.message).includes('row-level security') ? 403 : 401)
    : err.code === '23505' ? 409
    : err.code === 'P0002' ? 404
    : 400;
  return new HttpError(status, { code: err.code ?? 'PGRST000', message: err.message, details: err.detail ?? null, hint: err.hint ?? null });
}

function shape(req: Req, rows: unknown[]) {
  if (wantsObject(req)) {
    if (rows.length !== 1) {
      throw new HttpError(406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: `The result contains ${rows.length} rows`,
        hint: null,
      });
    }
    return rows[0];
  }
  return rows;
}

interface FnInfo {
  args: { name: string; type: string }[];
  retset: boolean;
  scalar: boolean;
}
const fnCache = new Map<string, FnInfo>();

async function fnInfo(name: string): Promise<FnInfo> {
  const cached = fnCache.get(name);
  if (cached) return cached;
  const r = await pool.query<{ names: string[] | null; types: string[]; retset: boolean; rettype: string; typtype: string }>(
    `select p.proargnames as names,
            array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
            p.proretset as retset, format_type(p.prorettype, null) as rettype, rt.typtype::text as typtype
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
      where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  const row = r.rows[0];
  if (!row) throw new HttpError(404, { code: 'PGRST202', message: `Could not find the function public.${name}` });
  const info: FnInfo = {
    args: row.types.map((type, i) => ({ name: row.names?.[i] ?? `$${i + 1}`, type })),
    retset: row.retset,
    scalar: row.typtype !== 'c' && !row.retset,
  };
  fnCache.set(name, info);
  return info;
}

export async function handleRest(req: Req, sub: string): Promise<{ status: number; body?: unknown; headers?: Record<string, string> }> {
  try {
    if (sub.startsWith('/rpc/')) {
      const name = sub.slice(5);
      ident(name);
      const info = await fnInfo(name);
      const input: Record<string, unknown> =
        req.method === 'GET' ? Object.fromEntries(req.query) : req.json<Record<string, unknown>>();
      const params: unknown[] = [];
      const args = info.args
        .filter((a) => a.name in input)
        .map((a) => {
          const v = input[a.name];
          params.push(a.type === 'jsonb' || a.type === 'json' ? JSON.stringify(v) : v);
          return `${ident(a.name)} => $${params.length}::${a.type}`;
        });
      const call = `public.${ident(name)}(${args.join(', ')})`;
      const result = await withRole(req.claims, async (c) => {
        if (info.scalar) {
          const r = await c.query(`select ${call} as v`, params);
          return r.rows[0]?.v ?? null;
        }
        const r = await c.query(`select * from ${call}`, params);
        if (info.retset) return shape(req, r.rows);
        const row = r.rows[0];
        return row && Object.values(row).every((v) => v === null) ? null : row;
      });
      return { status: 200, body: result };
    }

    const table = ident(sub.replace(/^\//, ''));
    const params: unknown[] = [];

    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = buildWhere(req.query, params);
      const limit = req.query.get('limit');
      const offset = req.query.get('offset');
      const sql = `select ${buildSelect(req.query.get('select'))} from public.${table} ${where} ${buildOrder(req.query.get('order'))}
                   ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`;
      const { rows, total } = await withRole(req.claims, async (c) => {
        const r = await c.query(sql, params);
        let total: number | null = null;
        if (prefer(req, 'count')) {
          const cnt = await c.query(`select count(*)::int as n from public.${table} ${where}`, params);
          total = cnt.rows[0].n;
        }
        return { rows: r.rows, total };
      });
      const from = Number(offset ?? 0);
      const range = rows.length ? `${from}-${from + rows.length - 1}` : '*';
      return {
        status: 200,
        body: req.method === 'HEAD' ? undefined : shape(req, rows),
        headers: { 'content-range': `${range}/${total ?? '*'}` },
      };
    }

    const returning = prefer(req, 'return') === 'representation' ? 'returning *' : '';

    if (req.method === 'POST') {
      const body = req.json<Record<string, unknown> | Record<string, unknown>[]>();
      const rowsIn = Array.isArray(body) ? body : [body];
      const cols = [...new Set(rowsIn.flatMap((r) => Object.keys(r)))].map(ident);
      params.push(JSON.stringify(rowsIn));
      const sql = `insert into public.${table} (${cols.join(', ')})
                   select ${cols.join(', ')} from json_populate_recordset(null::public.${table}, $1::json) ${returning}`;
      const rows = await withRole(req.claims, async (c) => (await c.query(sql, params)).rows);
      return { status: 201, body: returning ? shape(req, rows) : undefined };
    }

    if (req.method === 'PATCH') {
      const body = req.json<Record<string, unknown>>();
      const cols = Object.keys(body).map(ident);
      params.push(JSON.stringify(body));
      const where = buildWhere(req.query, params);
      const sql = `update public.${table} set (${cols.join(', ')}) =
                   (select ${cols.join(', ')} from json_populate_record(null::public.${table}, $1::json))
                   ${where} ${returning}`;
      const rows = await withRole(req.claims, async (c) => (await c.query(sql, params)).rows);
      return { status: returning ? 200 : 204, body: returning ? shape(req, rows) : undefined };
    }

    if (req.method === 'DELETE') {
      const where = buildWhere(req.query, params);
      const rows = await withRole(req.claims, async (c) => (await c.query(`delete from public.${table} ${where} ${returning}`, params)).rows);
      return { status: returning ? 200 : 204, body: returning ? shape(req, rows) : undefined };
    }

    throw new HttpError(405, { code: 'PGRST000', message: 'method not allowed' });
  } catch (e) {
    throw pgError(e);
  }
}
