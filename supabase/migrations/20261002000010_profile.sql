-- Parri · расширенный профиль и регистрация по шагам (как на theparri.com):
-- аккаунт → код → пароль → личные данные → место и язык → профессия → навыки → о себе и портфолио →
-- образование → безопасность и соглашения → готово. Регистрация с 16 лет.
-- Каждый шаг сохраняется одной RPC save_profile_data(jsonb); завершает регистрацию complete_onboarding().

create type public.experience_level as enum ('junior', 'middle', 'expert');
create type public.platform_role as enum ('executor', 'customer', 'both');
create type public.availability as enum ('available', 'busy', 'hidden');
create type public.response_time as enum ('5m', '1h', '3h', 'day');
create type public.portfolio_visibility as enum ('public', 'clients', 'private');
create type public.skill_level as enum ('a1', 'a2', 'b1', 'b2', 'c1', 'c2');

-- ---------- Новые навыки для новых категорий ----------
insert into public.skills (slug, category, sort) values
  ('desk_research', 'research', 33), ('surveys', 'research', 34), ('fact_checking', 'research', 35),
  ('beatmaking', 'music', 72), ('mixing', 'music', 73), ('songwriting', 'music', 74),
  ('blender', '3d', 75), ('modeling_3d', '3d', 76), ('rendering', '3d', 77),
  ('animation_2d', 'animation', 43), ('animation_3d', 'animation', 44),
  ('ios', 'mobile', 15), ('android', 'mobile', 16), ('flutter', 'mobile', 17), ('react_native', 'mobile', 18),
  ('unity', 'gamedev', 19), ('unreal', 'gamedev', 23), ('game_design', 'gamedev', 24),
  ('prompting', 'ai', 25), ('ml', 'ai', 26), ('ai_automation', 'ai', 27),
  ('math_tutor', 'tutor', 52), ('language_tutor', 'tutor', 53), ('exam_prep', 'tutor', 54),
  ('contracts', 'legal', 110), ('legal_advice', 'legal', 111),
  ('accounting', 'finance', 112), ('financial_models', 'finance', 113),
  ('business_plans', 'business', 114), ('market_analysis', 'business', 115), ('sales', 'business', 116),
  ('voice_acting', 'voiceover', 117), ('dubbing', 'voiceover', 118),
  ('podcast_editing', 'podcast', 119), ('podcast_hosting', 'podcast', 120),
  ('javascript', 'code', 28), ('typescript', 'code', 29), ('sql', 'code', 36), ('web_design', 'design', 5),
  ('branding', 'design', 6), ('presentation_design', 'presentations', 82), ('proofreading', 'writing', 37),
  ('targeting', 'marketing', 38), ('content_plan', 'marketing', 39)
on conflict (slug) do nothing;

-- ---------- Профиль: новые поля ----------
alter table public.profiles
  add column username extensions.citext unique
    check (username ~ '^[a-z0-9_.]{3,30}$'),
  add column display_name text check (char_length(btrim(display_name)) between 1 and 60),
  add column headline text check (char_length(headline) <= 80),
  add column profession text check (char_length(profession) <= 80),
  add column experience_level public.experience_level,
  add column country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  add column city text check (char_length(city) <= 80),
  add column timezone text check (char_length(timezone) <= 60),
  add column languages jsonb not null default '[]' check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 10),
  add column display_currency text not null default 'USD' check (display_currency in ('USD', 'EUR', 'RUB', 'AED', 'KZT')),
  add column custom_skills text[] not null default '{}' check (cardinality(custom_skills) <= 10),
  add column links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  add column faculty text check (char_length(faculty) <= 120),
  add column specialty text check (char_length(specialty) <= 120),
  add column platform_role public.platform_role not null default 'both',
  add column availability public.availability not null default 'available',
  add column preferred_kinds public.task_kind[] not null default '{online,nearby,campus}',
  add column response_time public.response_time,
  add column hidden_fields text[] not null default '{}',
  add column notify_skill_tasks boolean not null default true,
  add column onboarded_at timestamptz;

-- О себе: до 1000 символов (было 500)
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 1000);

alter table public.profile_private
  add column student_email extensions.citext check (student_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column two_factor_enabled boolean not null default false,
  add column notifications_enabled boolean not null default true,
  add column terms_accepted_at timestamptz,
  add column privacy_accepted_at timestamptz;

-- Шесть языков интерфейса
alter table public.profile_private drop constraint if exists profile_private_locale_check;
alter table public.profile_private add constraint profile_private_locale_check
  check (locale in ('ru', 'en', 'de', 'fr', 'it', 'es'));

-- Уровень и порядок навыков (перетаскивание)
alter table public.profile_skills
  add column level public.skill_level,
  add column sort int not null default 0;

-- ---------- Опыт работы ----------
create table public.profile_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  company text not null check (char_length(btrim(company)) between 1 and 120),
  position text not null check (char_length(btrim(position)) between 1 and 120),
  from_year int check (from_year between 1950 and 2100),
  to_year int check (to_year between 1950 and 2100),
  sort int not null default 0
);
create index profile_experience_profile on public.profile_experience (profile_id, sort);
alter table public.profile_experience enable row level security;
create policy profile_experience_read on public.profile_experience for select to anon, authenticated using (true);
revoke insert, update, delete on public.profile_experience from anon, authenticated;

-- ---------- Портфолио ----------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  url text check (url ~* '^https?://' and char_length(url) <= 1000),
  file_path text check (char_length(file_path) <= 500),
  category public.task_category,
  visibility public.portfolio_visibility not null default 'public',
  created_at timestamptz not null default now(),
  constraint portfolio_has_content check (url is not null or file_path is not null)
);
create index portfolio_items_profile on public.portfolio_items (profile_id, created_at desc);
alter table public.portfolio_items enable row level security;

-- Был ли зритель заказчиком у этого исполнителя (для видимости «только клиентам»)
create or replace function private.is_client_of(p_executor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks
    where executor_id = p_executor and customer_id = auth.uid()
  )
$$;

create policy portfolio_read on public.portfolio_items for select to anon, authenticated using (
  profile_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'clients' and private.is_client_of(profile_id))
  or private.is_staff()
);
create policy portfolio_own_insert on public.portfolio_items for insert to authenticated
  with check (profile_id = auth.uid());
create policy portfolio_own_delete on public.portfolio_items for delete to authenticated
  using (profile_id = auth.uid());
create policy portfolio_own_update on public.portfolio_items for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke all on public.portfolio_items from anon;
grant select on public.portfolio_items to anon;
grant select, insert, update, delete on public.portfolio_items to authenticated;

-- ---------- Валидация ----------
create or replace function private.valid_url(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~* '^https?://[^\s]+$' and char_length(p) <= 1000
$$;

/** Имя пользователя свободно? (без учёта своего) */
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[a-z0-9_.]{3,30}$'
     and not exists (
       select 1 from public.profiles
       where username = p_username::extensions.citext and id is distinct from auth.uid()
     )
$$;

-- ---------- Сохранение данных профиля (любой шаг регистрации и редактирование) ----------
-- Обновляются только переданные ключи. Неизвестные ключи игнорируются.
create or replace function public.save_profile_data(p jsonb) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_priv public.profile_private;
  v_birth date;
  v_text text;
  v_item jsonb;
  v_skills text[];
  v_i int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.banned_at is not null then
    raise exception 'account_blocked' using errcode = '42501';
  end if;
  select * into v_priv from public.profile_private where id = v_uid for update;

  -- Личные данные
  if p ? 'first_name' then
    if char_length(btrim(coalesce(p ->> 'first_name', ''))) not between 1 and 50 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
    v_profile.first_name := btrim(p ->> 'first_name');
  end if;
  if p ? 'last_name' then
    if char_length(btrim(coalesce(p ->> 'last_name', ''))) not between 1 and 50 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
    v_profile.last_name := btrim(p ->> 'last_name');
  end if;
  if p ? 'display_name' then
    v_profile.display_name := nullif(btrim(coalesce(p ->> 'display_name', '')), '');
  end if;
  if p ? 'avatar_url' then
    v_profile.avatar_url := nullif(p ->> 'avatar_url', '');
  end if;
  if p ? 'birth_date' then
    -- Дату рождения меняют только при регистрации (иначе — через поддержку)
    if v_profile.onboarding = 'done' and v_priv.birth_date is not null
       and (p ->> 'birth_date')::date is distinct from v_priv.birth_date then
      raise exception 'birth_date_locked' using errcode = '42501';
    end if;
    begin
      v_birth := (p ->> 'birth_date')::date;
    exception when others then
      raise exception 'invalid_birth_date' using errcode = '22023';
    end;
    if v_birth is null or v_birth > current_date or public.age_years(v_birth) > 120 then
      raise exception 'invalid_birth_date' using errcode = '22023';
    end if;
    if public.age_years(v_birth) < 16 then
      raise exception 'age_under_16' using errcode = '22023';
    end if;
    v_priv.birth_date := v_birth;
  end if;
  if p ? 'phone' then
    v_priv.phone := nullif(p ->> 'phone', '');
  end if;
  if p ? 'username' then
    v_text := lower(btrim(coalesce(p ->> 'username', '')));
    if v_text !~ '^[a-z0-9_.]{3,30}$' then
      raise exception 'invalid_username' using errcode = '22023';
    end if;
    if not public.username_available(v_text) then
      raise exception 'username_taken' using errcode = '23505';
    end if;
    v_profile.username := v_text;
  end if;

  -- Место и язык
  if p ? 'country_code' then v_profile.country_code := nullif(upper(p ->> 'country_code'), ''); end if;
  if p ? 'city' then v_profile.city := nullif(btrim(coalesce(p ->> 'city', '')), ''); end if;
  if p ? 'timezone' then v_profile.timezone := nullif(p ->> 'timezone', ''); end if;
  if p ? 'locale' then v_priv.locale := coalesce(nullif(p ->> 'locale', ''), 'ru'); end if;
  if p ? 'display_currency' then v_profile.display_currency := coalesce(nullif(p ->> 'display_currency', ''), 'USD'); end if;
  if p ? 'languages' then
    if jsonb_typeof(p -> 'languages') <> 'array' then
      raise exception 'invalid_languages' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(p -> 'languages') loop
      if coalesce(v_item ->> 'code', '') !~ '^[a-z]{2,3}$'
         or coalesce(v_item ->> 'level', 'b1') not in ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native') then
        raise exception 'invalid_languages' using errcode = '22023';
      end if;
    end loop;
    v_profile.languages := p -> 'languages';
  end if;

  -- Профессия
  if p ? 'profession' then v_profile.profession := nullif(btrim(coalesce(p ->> 'profession', '')), ''); end if;
  if p ? 'headline' then v_profile.headline := nullif(btrim(coalesce(p ->> 'headline', '')), ''); end if;
  if p ? 'experience_level' then
    v_profile.experience_level := nullif(p ->> 'experience_level', '')::public.experience_level;
  end if;

  -- Навыки: массив slug из каталога (порядок = порядок в профиле) + свои навыки
  if p ? 'skills' then
    select coalesce(array_agg(x), '{}') into v_skills from jsonb_array_elements_text(p -> 'skills') x;
    if cardinality(v_skills) > 30 then
      raise exception 'too_many_skills' using errcode = '22023';
    end if;
    delete from public.profile_skills where profile_id = v_uid;
    foreach v_text in array v_skills loop
      v_i := v_i + 1;
      insert into public.profile_skills (profile_id, skill_slug, sort, level)
      values (v_uid, v_text, v_i, nullif(p -> 'skill_levels' ->> v_text, '')::public.skill_level)
      on conflict do nothing;
    end loop;
  end if;
  if p ? 'custom_skills' then
    select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}')
      into v_profile.custom_skills from jsonb_array_elements_text(p -> 'custom_skills') x;
    if exists (select 1 from unnest(v_profile.custom_skills) c where char_length(c) > 40) then
      raise exception 'too_long' using errcode = '22023';
    end if;
  end if;

  -- О себе, портфолио, ссылки, опыт
  if p ? 'bio' then
    v_text := nullif(btrim(coalesce(p ->> 'bio', '')), '');
    if v_text is not null and char_length(v_text) < 40 then
      raise exception 'bio_short' using errcode = '22023';
    end if;
    v_profile.bio := v_text;
  end if;
  if p ? 'portfolio_links' then
    select coalesce(array_agg(x), '{}') into v_profile.portfolio_links from jsonb_array_elements_text(p -> 'portfolio_links') x;
    if exists (select 1 from unnest(v_profile.portfolio_links) u where not private.valid_url(u)) then
      raise exception 'invalid_link' using errcode = '22023';
    end if;
  end if;
  if p ? 'links' then
    for v_item in select * from jsonb_array_elements(coalesce(p -> 'links', '[]')) loop
      if not private.valid_url(coalesce(v_item ->> 'url', '')) or char_length(coalesce(v_item ->> 'title', '')) > 60 then
        raise exception 'invalid_link' using errcode = '22023';
      end if;
    end loop;
    v_profile.links := coalesce(p -> 'links', '[]');
  end if;
  if p ? 'experience' then
    delete from public.profile_experience where profile_id = v_uid;
    v_i := 0;
    for v_item in select * from jsonb_array_elements(coalesce(p -> 'experience', '[]')) loop
      v_i := v_i + 1;
      if v_i > 10 then
        raise exception 'too_many' using errcode = '22023';
      end if;
      insert into public.profile_experience (profile_id, company, position, from_year, to_year, sort)
      values (v_uid, v_item ->> 'company', v_item ->> 'position',
              nullif(v_item ->> 'from_year', '')::int, nullif(v_item ->> 'to_year', '')::int, v_i);
    end loop;
  end if;

  -- Образование
  if p ? 'university_id' then v_profile.university_id := nullif(p ->> 'university_id', '')::bigint; end if;
  if p ? 'faculty' then v_profile.faculty := nullif(btrim(coalesce(p ->> 'faculty', '')), ''); end if;
  if p ? 'specialty' then v_profile.specialty := nullif(btrim(coalesce(p ->> 'specialty', '')), ''); end if;
  if p ? 'student_email' then v_priv.student_email := nullif(btrim(coalesce(p ->> 'student_email', '')), ''); end if;

  -- Работа на платформе и видимость
  if p ? 'platform_role' then v_profile.platform_role := (p ->> 'platform_role')::public.platform_role; end if;
  if p ? 'availability' then v_profile.availability := (p ->> 'availability')::public.availability; end if;
  if p ? 'preferred_kinds' then
    select coalesce(array_agg(x::public.task_kind), '{}') into v_profile.preferred_kinds from jsonb_array_elements_text(p -> 'preferred_kinds') x;
  end if;
  if p ? 'response_time' then v_profile.response_time := nullif(p ->> 'response_time', '')::public.response_time; end if;
  if p ? 'hidden_fields' then
    select coalesce(array_agg(x), '{}') into v_profile.hidden_fields from jsonb_array_elements_text(p -> 'hidden_fields') x;
  end if;
  if p ? 'notify_skill_tasks' then v_profile.notify_skill_tasks := (p ->> 'notify_skill_tasks')::boolean; end if;
  if p ? 'notifications_enabled' then v_priv.notifications_enabled := (p ->> 'notifications_enabled')::boolean; end if;
  if p ? 'two_factor_enabled' then v_priv.two_factor_enabled := (p ->> 'two_factor_enabled')::boolean; end if;

  update public.profile_private set
    birth_date = v_priv.birth_date, phone = v_priv.phone, locale = v_priv.locale,
    student_email = v_priv.student_email, notifications_enabled = v_priv.notifications_enabled,
    two_factor_enabled = v_priv.two_factor_enabled
  where id = v_uid;

  update public.profiles set
    first_name = v_profile.first_name, last_name = v_profile.last_name, display_name = v_profile.display_name,
    avatar_url = v_profile.avatar_url, username = v_profile.username,
    country_code = v_profile.country_code, city = v_profile.city, timezone = v_profile.timezone,
    display_currency = v_profile.display_currency, languages = v_profile.languages,
    profession = v_profile.profession, headline = v_profile.headline, experience_level = v_profile.experience_level,
    custom_skills = v_profile.custom_skills, bio = v_profile.bio, portfolio_links = v_profile.portfolio_links,
    links = v_profile.links, university_id = v_profile.university_id, faculty = v_profile.faculty,
    specialty = v_profile.specialty, platform_role = v_profile.platform_role,
    availability = v_profile.availability, preferred_kinds = v_profile.preferred_kinds,
    response_time = v_profile.response_time, hidden_fields = v_profile.hidden_fields,
    notify_skill_tasks = v_profile.notify_skill_tasks,
    -- Как только есть имя и дата рождения, регистрация «в процессе»
    onboarding = case
      when onboarding = 'profile' and v_profile.first_name is not null and v_priv.birth_date is not null
        then 'skills'::public.onboarding_step
      else onboarding end
  where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

-- ---------- Завершение регистрации ----------
create or replace function public.complete_onboarding(
  p_terms boolean,
  p_privacy boolean,
  p_two_factor boolean default false,
  p_notifications boolean default true
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_birth date;
  v_base text;
  v_name text;
  v_n int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not coalesce(p_terms, false) or not coalesce(p_privacy, false) then
    raise exception 'terms_required' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  select birth_date into v_birth from public.profile_private where id = v_uid;
  if v_profile.first_name is null or v_profile.last_name is null or v_birth is null then
    raise exception 'profile_step_required' using errcode = '42501';
  end if;
  if public.age_years(v_birth) < 16 then
    raise exception 'age_under_16' using errcode = '22023';
  end if;
  if (select count(*) from public.profile_skills where profile_id = v_uid) + cardinality(v_profile.custom_skills) < 5 then
    raise exception 'skills_min' using errcode = '22023';
  end if;

  -- Имя пользователя по умолчанию: имя.фамилия латиницей не делаем — берём id и подбираем свободное
  if v_profile.username is null then
    v_base := 'user' || substr(replace(v_uid::text, '-', ''), 1, 8);
    v_name := v_base;
    while not public.username_available(v_name) loop
      v_n := v_n + 1;
      v_name := v_base || v_n;
    end loop;
    v_profile.username := v_name;
  end if;

  update public.profile_private
     set terms_accepted_at = now(), privacy_accepted_at = now(),
         two_factor_enabled = coalesce(p_two_factor, false),
         notifications_enabled = coalesce(p_notifications, true)
   where id = v_uid;

  update public.profiles
     set onboarding = 'done', onboarded_at = coalesce(onboarded_at, now()), username = v_profile.username
   where id = v_uid
  returning * into v_profile;
  return v_profile;
end $$;

-- Старые шаги регистрации заменены на save_profile_data / complete_onboarding
drop function if exists public.save_profile(text, text, date, text, text);
drop function if exists public.save_skills(text[], bigint);

-- Новые колонки клиент напрямую не пишет: только через save_profile_data
revoke update on public.profiles from authenticated;
revoke update on public.profile_private from authenticated;

revoke execute on function public.save_profile_data(jsonb), public.complete_onboarding(boolean, boolean, boolean, boolean),
  public.username_available(text) from public, anon;
grant execute on function public.save_profile_data(jsonb), public.complete_onboarding(boolean, boolean, boolean, boolean),
  public.username_available(text) to authenticated;

revoke all on function private.is_client_of(uuid), private.valid_url(text) from public;
grant execute on function private.is_client_of(uuid) to anon, authenticated, service_role;
grant execute on function private.valid_url(text) to authenticated, service_role;

-- ---------- Файлы портфолио (приватный бакет, видимость как у записи портфолио) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('portfolio', 'portfolio', false, 10485760)
on conflict (id) do nothing;

create policy portfolio_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy portfolio_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
-- Читать: владелец или тот, кому видна запись портфолио с этим файлом (RLS portfolio_items)
create policy portfolio_files_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'portfolio' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.portfolio_items pi where pi.file_path = name)
  )
);
