// Проверка SQL демо в PGlite (Node) без расширений — так же, как в браузере
import { PGlite } from '@electric-sql/pglite';
import { demoBootstrapSql } from './prepare-db.ts';

const db = new PGlite({ parsers: { 20: (v: string) => Number(v) } });
const t0 = Date.now();
await db.exec(demoBootstrapSql());
await db.exec(`select set_config('request.jwt.claims', '', false); reset role; set search_path = "$user", public, extensions;`);
console.log('bootstrap ms', Date.now() - t0);
const one = async (sql: string, p: unknown[] = []) => (await db.query<any>(sql, p)).rows;
const asUser = (uid: string, sql: string, p: unknown[] = []) =>
  db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await tx.exec('set local role authenticated');
    return (await tx.query<any>(sql, p)).rows;
  });
const maria = 'a0000000-0000-4000-8000-000000000003';
const anna = 'a0000000-0000-4000-8000-000000000001';
console.log('login ok', await one(`select encrypted_password = extensions.crypt('parri-demo-123', encrypted_password) ok from auth.users where email = 'anna@parri.test'`));
console.log('feed', (await asUser(maria, `select title from public.feed_tasks()`)).length);
console.log('nearby', await asUser(maria, `select round(distance_m) d from public.feed_tasks(p_kind => 'nearby', p_lat => 55.758, p_lng => 37.66)`));
try { await asUser(maria, `update public.wallets set available_cents = 1`); console.log('!!! FAIL'); } catch (e) { console.log('wallet blocked'); }
const sub = (await one(`select id from public.submissions where task_id = 'b0000000-0000-4000-8000-000000000007'`))[0].id;
await asUser(anna, `select public.review_submission($1, 'accept', array[true, true])`, [sub]);
console.log('ivan', await one(`select available_cents from public.wallets where user_id = 'a0000000-0000-4000-8000-000000000002'`), 'ledger', await one(`select sum(amount_cents)::int s from public.ledger_entries`));
console.log('arr param', await asUser(maria, `select count(*)::int n from public.skills where slug = any($1::text[])`, [['figma', 'slides']]));
await db.query(`insert into devstack.files (bucket, name, data, mime) values ('task-files','x', $1, 'text/plain')`, [new Uint8Array([1, 2, 3])]);
console.log('bytea', (await one(`select data from devstack.files`))[0].data);
