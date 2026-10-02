// SQL для демо: те же миграции и сиды, что в supabase/, адаптированные под PGlite без расширений.
// PostGIS, pgcrypto и pg_trgm в браузерный бандл не входят, поэтому:
//  - геометрия: встроенный тип point + обёртки st_* с теми же именами (гаверсинус, метры);
//  - пароли: crypt/gen_salt — совместимые обёртки на md5 (только для демо в браузере);
//  - триграммные индексы убраны (поиск через ilike работает и без них).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../supabase/', import.meta.url));

const SHIMS = `
create schema if not exists extensions;
create or replace function extensions.st_makepoint(x double precision, y double precision) returns point
  language sql immutable as $$ select point(x, y) $$;
create or replace function extensions.st_setsrid(p point, srid int) returns point language sql immutable as $$ select p $$;
create or replace function extensions.st_x(p point) returns double precision language sql immutable as $$ select p[0] $$;
create or replace function extensions.st_y(p point) returns double precision language sql immutable as $$ select p[1] $$;
create or replace function extensions.st_distance(a point, b point) returns double precision language sql immutable as $$
  select 2 * 6371008.8 * asin(sqrt(power(sin(radians(b[1] - a[1]) / 2), 2) +
    cos(radians(a[1])) * cos(radians(b[1])) * power(sin(radians(b[0] - a[0]) / 2), 2)))
$$;
create or replace function extensions.st_dwithin(a point, b point, d double precision) returns boolean
  language sql immutable as $$ select extensions.st_distance(a, b) <= d $$;
create or replace function extensions.gen_salt(t text) returns text
  language sql volatile as $$ select '$demo$' || substr(md5(random()::text), 1, 16) $$;
create or replace function extensions.crypt(pw text, salt text) returns text
  language sql immutable as $$ select substr(salt, 1, 22) || md5(substr(salt, 1, 22) || pw) $$;
grant usage on schema extensions to public;
grant execute on all functions in schema extensions to public;
`;

const DEVSTACK = `
create schema if not exists devstack;
create table if not exists devstack.otps (id bigint generated always as identity primary key, email text not null,
  type text not null, code text not null, created_at timestamptz not null default now(), used_at timestamptz);
create table if not exists devstack.refresh_tokens (token text primary key, user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(), revoked boolean not null default false);
create table if not exists devstack.files (bucket text not null, name text not null, data bytea not null,
  mime text not null, primary key (bucket, name));
revoke all on schema devstack from anon, authenticated;
`;

export function adaptStub(sql: string): string {
  return sql.replace(/create extension if not exists pgcrypto with schema extensions;/g, '');
}

export function adaptMigration(sql: string): string {
  return sql
    .replace(/create extension if not exists (postgis|citext|pg_trgm) with schema extensions;/g, '')
    .replace(/extensions\.geography\(point, 4326\)/g, 'point')
    .replace(/::extensions\.geography/g, '')
    .replace(/::extensions\.geometry/g, '')
    .replace(/extensions\.geography/g, 'point')
    .replace(/create index \w+ on public\.\w+ using gin \(\w+ extensions\.gin_trgm_ops\);/g, '')
    .replace(/create index tasks_location on public\.tasks using gist \(location\);/g, '');
}

export function demoBootstrapSql(): string {
  const parts = [adaptStub(readFileSync(root + 'local/stub.sql', 'utf8')), 'set search_path = "$user", public, extensions;', SHIMS];
  for (const f of readdirSync(root + 'migrations').sort()) parts.push(adaptMigration(readFileSync(root + 'migrations/' + f, 'utf8')));
  parts.push(readFileSync(root + 'seed/universities.sql', 'utf8'), readFileSync(root + 'seed.sql', 'utf8'), DEVSTACK);
  return parts.join('\n;\n');
}
