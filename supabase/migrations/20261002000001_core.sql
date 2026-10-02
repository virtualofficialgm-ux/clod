-- Parri · ядро: расширения, справочники, профили, онбординг.
-- Правило: всё, что меняет «чувствительные» поля (роль, план, статистика, дата рождения),
-- идёт через security definer функции; клиенту выданы права только на безопасные колонки.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists postgis with schema extensions;

-- Внутренняя схема: не публикуется через API (PostgREST видит только public)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------- Типы ----------
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.plan_id as enum ('free', 'pro');
create type public.onboarding_step as enum ('profile', 'skills', 'done');
create type public.task_kind as enum ('online', 'nearby', 'campus');
create type public.task_category as enum (
  'design', 'code', 'writing', 'marketing', 'video', 'study',
  'translation', 'photo', 'presentations', 'data', 'other'
);
create type public.result_format as enum ('pptx', 'pdf', 'jpg', 'text', 'photo', 'checkin');
create type public.task_deadline as enum ('1h', '24h', '3d');

-- ---------- Общие триггеры ----------
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Вузы (сид: весь мир) ----------
create table public.universities (
  id bigint generated always as identity primary key,
  name text not null,
  country_code char(2) not null,
  country text not null,
  domains text[] not null default '{}',
  web_page text,
  unique (name, country_code)
);
create index universities_name_trgm on public.universities using gin (name extensions.gin_trgm_ops);
create index universities_country on public.universities (country_code);
alter table public.universities enable row level security;
create policy universities_read on public.universities for select to anon, authenticated using (true);
revoke insert, update, delete on public.universities from anon, authenticated;

-- ---------- Навыки ----------
create table public.skills (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  category public.task_category not null,
  sort int not null default 0
);
alter table public.skills enable row level security;
create policy skills_read on public.skills for select to anon, authenticated using (true);
revoke insert, update, delete on public.skills from anon, authenticated;

insert into public.skills (slug, category, sort) values
  ('figma', 'design', 1), ('illustration', 'design', 2), ('logo', 'design', 3), ('ui_ux', 'design', 4),
  ('frontend', 'code', 10), ('backend', 'code', 11), ('python', 'code', 12), ('mobile_dev', 'code', 13), ('bots', 'code', 14),
  ('copywriting', 'writing', 20), ('editing', 'writing', 21), ('articles', 'writing', 22),
  ('smm', 'marketing', 30), ('seo', 'marketing', 31), ('research', 'marketing', 32),
  ('video_editing', 'video', 40), ('motion', 'video', 41), ('reels', 'video', 42),
  ('tutoring', 'study', 50), ('lecture_notes', 'study', 51),
  ('translation_en', 'translation', 60), ('translation_other', 'translation', 61),
  ('photography', 'photo', 70), ('retouch', 'photo', 71),
  ('slides', 'presentations', 80), ('pitch_decks', 'presentations', 81),
  ('excel', 'data', 90), ('data_analysis', 'data', 91), ('data_entry', 'data', 92),
  ('errands', 'other', 100), ('mystery_shopping', 'other', 101);

-- ---------- Профили ----------
-- Публичная часть: видна всем (публичная страница исполнителя)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(btrim(first_name)) between 1 and 50),
  last_name text check (char_length(btrim(last_name)) between 1 and 50),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 500),
  university_id bigint references public.universities (id),
  portfolio_links text[] not null default '{}' check (cardinality(portfolio_links) <= 10),
  role public.user_role not null default 'user',
  plan public.plan_id not null default 'free',
  onboarding public.onboarding_step not null default 'profile',
  rating_avg numeric(3, 2),
  rating_count int not null default 0,
  completed_count int not null default 0,
  earned_cents bigint not null default 0,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Приватная часть: только владелец
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date,
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  locale text not null default 'ru' check (locale in ('ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profile_private_touch before update on public.profile_private
  for each row execute function private.touch_updated_at();

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_slug text not null references public.skills (slug),
  primary key (profile_id, skill_slug)
);

-- ---------- Вспомогательные функции для RLS ----------
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin') and banned_at is null
  )
$$;

create or replace function private.my_university_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select university_id from public.profiles where id = auth.uid()
$$;

/** Полных лет на сегодня */
create or replace function public.age_years(p_birth date) returns int
language sql stable set search_path = '' as $$
  select extract(year from age(current_date, p_birth))::int
$$;

/** Текущий пользователь вошёл, не забанен и прошёл онбординг — иначе исключение */
create or replace function private.require_active_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.banned_at is not null then
    raise exception 'account_blocked' using errcode = '42501';
  end if;
  if v_profile.onboarding <> 'done' then
    raise exception 'onboarding_incomplete' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- ---------- RLS профилей ----------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.profile_skills enable row level security;

create policy profiles_read on public.profiles for select to anon, authenticated
  using (banned_at is null or id = auth.uid() or private.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Клиент может менять только «витринные» поля профиля
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, bio, university_id, portfolio_links)
  on public.profiles to authenticated;

create policy profile_private_own on public.profile_private for select to authenticated
  using (id = auth.uid());
create policy profile_private_update_own on public.profile_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profile_private from anon;
revoke insert, update, delete on public.profile_private from authenticated;
grant update (phone, locale) on public.profile_private to authenticated;

create policy profile_skills_read on public.profile_skills for select to anon, authenticated using (true);
create policy profile_skills_insert_own on public.profile_skills for insert to authenticated
  with check (profile_id = auth.uid());
create policy profile_skills_delete_own on public.profile_skills for delete to authenticated
  using (profile_id = auth.uid());
revoke update on public.profile_skills from anon, authenticated;
revoke insert, delete on public.profile_skills from anon;

-- ---------- Новый пользователь ----------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.profile_private (id, locale)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'ru'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- Онбординг ----------
-- Шаг «Профиль»: имя, фамилия, дата рождения (14+), телефон, язык
create or replace function public.save_profile(
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_phone text,
  p_locale text default 'ru'
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
  if public.age_years(p_birth_date) < 14 then
    raise exception 'age_under_14' using errcode = '22023';
  end if;
  if public.age_years(p_birth_date) > 120 then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;

  update public.profile_private
     set birth_date = p_birth_date, phone = p_phone, locale = coalesce(p_locale, 'ru')
   where id = v_uid;

  update public.profiles
     set first_name = btrim(p_first_name),
         last_name = btrim(p_last_name),
         onboarding = case when onboarding = 'profile' then 'skills'::public.onboarding_step else onboarding end
   where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

-- Шаг «Навыки»: навыки и (необязательно) вуз
create or replace function public.save_skills(p_skills text[], p_university_id bigint default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.onboarding = 'profile' then
    raise exception 'profile_step_required' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_skills, '{}')) > 20 then
    raise exception 'too_many_skills' using errcode = '22023';
  end if;

  delete from public.profile_skills where profile_id = v_uid;
  insert into public.profile_skills (profile_id, skill_slug)
    select v_uid, s from unnest(coalesce(p_skills, '{}')) as s
    on conflict do nothing;

  update public.profiles
     set university_id = coalesce(p_university_id, university_id),
         onboarding = 'done'
   where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

-- Функции API: только для вошедших
revoke execute on function public.save_profile(text, text, date, text, text) from public, anon;
revoke execute on function public.save_skills(text[], bigint) from public, anon;
grant execute on function public.save_profile(text, text, date, text, text) to authenticated;
grant execute on function public.save_skills(text[], bigint) to authenticated;

-- Внутренние функции недоступны напрямую, кроме хелперов для RLS
revoke all on all functions in schema private from public;
grant execute on function private.is_staff(), private.my_university_id() to anon, authenticated, service_role;
