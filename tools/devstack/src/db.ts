import pg from 'pg';

// Как PostgREST: bigint и numeric отдаются клиенту числами JSON (центы < 2^53)
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  max: 10,
});

export type Role = 'anon' | 'authenticated' | 'service_role';

export interface Claims {
  role: Role;
  sub?: string;
  [k: string]: unknown;
}

/**
 * Выполнить запросы от имени роли API так же, как это делает PostgREST:
 * транзакция, set local role, request.jwt.claims — RLS и права работают по-настоящему.
 */
export async function withRole<T>(claims: Claims, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await client.query(`set local role ${claims.role === 'service_role' ? 'service_role' : claims.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Служебные таблицы devstack (refresh-токены, коды из писем) */
export async function ensureDevstackSchema(): Promise<void> {
  await pool.query(`
    create schema if not exists devstack;
    create table if not exists devstack.otps (
      id bigint generated always as identity primary key,
      email text not null,
      type text not null,
      code text not null,
      created_at timestamptz not null default now(),
      used_at timestamptz
    );
    create table if not exists devstack.refresh_tokens (
      token text primary key,
      user_id uuid not null references auth.users (id) on delete cascade,
      created_at timestamptz not null default now(),
      revoked boolean not null default false
    );
    revoke all on schema devstack from anon, authenticated;
  `);
}
