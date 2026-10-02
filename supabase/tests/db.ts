import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeEach } from 'vitest';

/**
 * Интеграционные тесты идут против настоящего Postgres с применёнными миграциями
 * (локально: supabase/local/db.sh reset; или `supabase start`/`supabase db reset`).
 * Каждый тест выполняется в транзакции и откатывается.
 */
const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const pool = new pg.Pool({ connectionString: url, max: 2 });

export interface Db {
  client: pg.PoolClient;
  /** Выполнить запрос от имени пользователя (роль authenticated + JWT claims) */
  as<T extends pg.QueryResultRow = pg.QueryResultRow>(uid: string | null, sql: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
  /** Запрос от имени владельца базы (обходит RLS) */
  sys<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
  /** Ожидать ошибку с сообщением */
  fails(promise: Promise<unknown>, message: string | RegExp): Promise<void>;
}

let current: pg.PoolClient | null = null;

export function useDb(): Db {
  beforeEach(async () => {
    current = await pool.connect();
    await current.query('begin');
  });
  afterEach(async () => {
    await current?.query('rollback');
    current?.release();
    current = null;
  });
  afterAll(async () => {
    // пул закрываем один раз на файл
  });

  const run = async (sql: string, params?: unknown[]) => current!.query(sql, params);

  return {
    get client() {
      return current!;
    },
    async as(uid, sql, params) {
      await run('savepoint as_user');
      try {
        if (uid) {
          await run(`select set_config('request.jwt.claims', $1, true)`, [
            JSON.stringify({ sub: uid, role: 'authenticated' }),
          ]);
          await run('set local role authenticated');
        } else {
          await run(`select set_config('request.jwt.claims', '', true)`);
          await run('set local role anon');
        }
        const res = await run(sql, params);
        // Как в PostgREST: отложенные проверки (баланс проводок) выполняются при коммите
        // ещё под ролью пользователя — форсируем их здесь, пока роль не сброшена
        await run('set constraints all immediate');
        await run('set constraints all deferred');
        await run('reset role');
        await run('release savepoint as_user');
        return res as never;
      } catch (e) {
        await run('rollback to savepoint as_user');
        await run('reset role');
        throw e;
      }
    },
    async sys(sql, params) {
      await run('savepoint sys');
      try {
        const res = await run(sql, params);
        await run('set constraints all immediate');
        await run('set constraints all deferred');
        await run('release savepoint sys');
        return res as never;
      } catch (e) {
        await run('rollback to savepoint sys');
        throw e;
      }
    },
    async fails(promise, message) {
      let error: unknown;
      try {
        await promise;
      } catch (e) {
        error = e;
      }
      if (!error) throw new Error(`expected failure ${String(message)}`);
      const text = (error as Error).message;
      const ok = typeof message === 'string' ? text.includes(message) : message.test(text);
      if (!ok) throw new Error(`expected "${String(message)}", got "${text}"`);
    },
  };
}

export interface TestUser {
  id: string;
  email: string;
}

/** Создать пользователя, пройти онбординг, (опционально) пополнить баланс */
export async function createUser(
  db: Db,
  opts: { balance?: number; university?: string | null; plan?: 'free' | 'pro'; onboarded?: boolean; role?: string } = {},
): Promise<TestUser> {
  const id = randomUUID();
  const email = `t-${id.slice(0, 8)}@test.local`;
  await db.sys(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{"locale":"ru"}')`, [id, email]);
  const uni =
    opts.university === null
      ? null
      : (
          await db.sys<{ id: number }>(`select id from public.universities where name = $1 limit 1`, [
            opts.university ?? 'Lomonosov Moscow State University',
          ])
        ).rows[0]?.id ?? null;
  await db.sys(
    `update public.profiles set first_name = 'Тест', last_name = 'Пользователь', university_id = $2,
       onboarding = $3, plan = $4, role = $5 where id = $1`,
    [id, uni, opts.onboarded === false ? 'profile' : 'done', opts.plan ?? 'free', opts.role ?? 'user'],
  );
  await db.sys(`update public.profile_private set birth_date = '2004-01-01' where id = $1`, [id]);
  if (opts.balance) await db.sys(`select public.dev_credit($1, $2)`, [id, opts.balance]);
  return { id, email };
}

export interface PublishOpts {
  reward?: number;
  currency?: 'USD' | 'USDT';
  kind?: 'online' | 'nearby' | 'campus';
  checklist?: string[];
  id?: string;
}

export async function publish(db: Db, customer: string, opts: PublishOpts = {}): Promise<string> {
  const id = opts.id ?? randomUUID();
  const kind = opts.kind ?? 'online';
  await db.as(
    customer,
    `select public.publish_task(p_id => $1, p_title => 'Тестовая задача', p_brief => 'Короткая инструкция',
       p_category => 'design', p_result_format => 'pdf', p_deadline => '24h', p_kind => $2,
       p_reward_cents => $3, p_checklist => $4,
       p_lat => $5, p_lng => $6, p_radius_m => $7, p_currency => $8)`,
    [
      id,
      kind,
      opts.reward ?? 2500,
      opts.checklist ?? ['Пункт 1', 'Пункт 2'],
      kind === 'nearby' ? 55.75 : null,
      kind === 'nearby' ? 37.61 : null,
      kind === 'nearby' ? 250 : null,
      opts.currency ?? 'USD',
    ],
  );
  return id;
}

export async function respond(db: Db, executor: string, task: string, price = 2500): Promise<string> {
  const res = await db.as<{ id: string }>(
    executor,
    `select (public.submit_response($1, 'Сделаю аккуратно и вовремя, есть опыт.', $2, '24h')).id`,
    [task, price],
  );
  return res.rows[0]!.id;
}

/** Все балансы кошелька в центах */
export async function walletFull(db: Db, uid: string) {
  const r = await db.sys<Record<string, string>>(
    `select available_cents, safe_cents, held_cents, usdt_available_cents, usdt_safe_cents, usdt_held_cents
       from public.wallets where user_id = $1`,
    [uid],
  );
  return Object.fromEntries(Object.entries(r.rows[0]!).map(([k, v]) => [k.replace('_cents', ''), Number(v)]));
}

/** Пополнение через «вебхук»: платёж создан и подтверждён сервисными функциями */
export async function creditVia(db: Db, uid: string, cents: number, currency: 'USD' | 'USDT' = 'USD'): Promise<string> {
  const ref = `ref_${randomUUID()}`;
  await db.sys(`select public.svc_payment_create($1, 'topup', $2, $3, $4, $5)`, [
    uid,
    currency === 'USDT' ? 'nowpayments' : 'stripe',
    currency,
    cents,
    ref,
  ]);
  await db.sys(`select public.svc_payment_succeeded($1)`, [ref]);
  return ref;
}

export async function wallet(db: Db, uid: string) {
  const r = await db.sys<{ available_cents: string; safe_cents: string }>(
    `select available_cents, safe_cents from public.wallets where user_id = $1`,
    [uid],
  );
  return { available: Number(r.rows[0]!.available_cents), safe: Number(r.rows[0]!.safe_cents) };
}

/** Инварианты учёта: кэши балансов совпадают с журналом, сумма всех проводок — ноль */
export async function assertLedgerInvariants(db: Db): Promise<void> {
  // Отложенная проверка «сумма транзакции = 0» срабатывает при коммите; тесты откатываются,
  // поэтому форсируем её здесь
  await db.sys('set constraints all immediate');
  await db.sys('set constraints all deferred');
  const sum = (account: string, currency: string, col: string) => `
    select '${account}-${currency}' as name, count(*)::text as bad from public.wallets w
      where w.${col} <> coalesce((select sum(amount_cents) from public.ledger_entries l
        where l.user_id = w.user_id and l.account = '${account}' and l.currency = '${currency}'), 0)`;
  const checks = await db.sys<{ name: string; bad: string }>(`
    select 'total' as name, count(*)::text as bad from (
      select currency from public.ledger_entries group by currency having sum(amount_cents) <> 0) x
    union all ${sum('available', 'USD', 'available_cents')}
    union all ${sum('escrow', 'USD', 'safe_cents')}
    union all ${sum('hold', 'USD', 'held_cents')}
    union all ${sum('available', 'USDT', 'usdt_available_cents')}
    union all ${sum('escrow', 'USDT', 'usdt_safe_cents')}
    union all ${sum('hold', 'USDT', 'usdt_held_cents')}
    union all
    select 'escrow', count(*)::text from public.escrow_accounts e
      where e.balance_cents <> coalesce((select sum(amount_cents) from public.ledger_entries l
        where l.task_id = e.task_id and l.account = 'escrow'), 0)
    union all
    select 'tx', count(*)::text from (
      select tx_id from public.ledger_entries group by tx_id, currency having sum(amount_cents) <> 0) t
  `);
  for (const row of checks.rows) {
    if (row.bad !== '0') throw new Error(`ledger invariant "${row.name}" violated (${row.bad})`);
  }
}

export async function closePool() {
  await pool.end();
}
