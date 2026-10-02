-- Parri · задачи по справочнику theparri.com:
--  «Взять задачу» сразу (до 10 в день, начать за 25 минут, отказ), вопросы по задаче, закладки и пропуск,
--  жалобы, черновики, продление срока, чаевые, подробная доработка, отзывы с оценками по пунктам,
--  просмотр и сравнение откликов, расширенная лента.

-- ---------- Новые поля ----------
alter table public.tasks
  add column started_at timestamptz,
  add column take_mode text check (take_mode in ('response', 'instant')),
  add column language text check (language ~ '^[a-z]{2,3}$'),
  add column required_level public.experience_level,
  add column proofs text[] not null default '{}' check (proofs <@ array['photo', 'checkin', 'comment']),
  add column visit_window text check (char_length(visit_window) <= 80),
  add column campus_building text check (char_length(campus_building) <= 120),
  add column skills text[] not null default '{}' check (cardinality(skills) <= 10);

alter table public.task_responses
  add column video_url text check (video_url ~* '^https?://\S+$' and char_length(video_url) <= 500),
  add column viewed_at timestamptz,
  add column compared boolean not null default false;

alter table public.submissions
  add column stage text not null default 'final' check (stage in ('final', 'intermediate')),
  add column included text[] not null default '{}' check (included <@ array['matches_task', 'materials_attached', 'files_checked']),
  add column note text check (char_length(note) <= 2000),
  add column revision_items int[],
  add column revision_criteria text[] check (revision_criteria <@ array['structure', 'quality', 'formatting', 'completeness', 'deadline']),
  add column revision_due timestamptz;

alter table public.profiles add column refusals_count int not null default 0;

-- Порядок сообщений: несколько событий в одной транзакции получают разное время (now() одинаков внутри транзакции)
alter table public.messages alter column created_at set default clock_timestamp();

-- ---------- Закладки и пропуск ----------
create table public.task_bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
create table public.task_skips (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table public.task_bookmarks enable row level security;
alter table public.task_skips enable row level security;
create policy bookmarks_own on public.task_bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and private.can_view_task(task_id));
create policy skips_own on public.task_skips for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.task_bookmarks, public.task_skips from anon;
grant select, insert, delete on public.task_bookmarks, public.task_skips to authenticated;

-- ---------- Жалобы на задачу (автор не узнает, кто пожаловался) ----------
create type public.complaint_reason as enum ('fraud', 'prohibited', 'discrimination', 'wrong_category', 'spam', 'other');
create type public.complaint_status as enum ('new', 'in_review', 'rejected', 'escalated', 'resolved');
create table public.task_complaints (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) default auth.uid(),
  reason public.complaint_reason not null,
  details text check (char_length(details) <= 1000),
  status public.complaint_status not null default 'new',
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (task_id, reporter_id)
);
alter table public.task_complaints enable row level security;
create policy complaints_read on public.task_complaints for select to authenticated
  using (reporter_id = auth.uid() or private.is_staff());
revoke all on public.task_complaints from anon;
revoke insert, update, delete on public.task_complaints from authenticated;
grant select on public.task_complaints to authenticated;

-- ---------- Вопросы по задаче (публичные) ----------
create table public.task_questions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  parent_id uuid references public.task_questions (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index task_questions_task on public.task_questions (task_id, created_at);
alter table public.task_questions enable row level security;
create policy questions_read on public.task_questions for select to authenticated
  using (private.can_view_task(task_id));
revoke all on public.task_questions from anon;
revoke insert, update, delete on public.task_questions from authenticated;
grant select on public.task_questions to authenticated;

-- ---------- Черновики задач (с любого устройства) ----------
create table public.task_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 32768),
  updated_at timestamptz not null default now()
);
create index task_drafts_user on public.task_drafts (user_id, updated_at desc);
alter table public.task_drafts enable row level security;
create policy drafts_own on public.task_drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.task_drafts from anon;
grant select, insert, update, delete on public.task_drafts to authenticated;

-- ---------- Продление срока ----------
create table public.task_extensions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  minutes int not null check (minutes in (15, 30, 60, 180, 1440)),
  reason text check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index task_extensions_one_pending on public.task_extensions (task_id) where status = 'pending';
alter table public.task_extensions enable row level security;
create policy extensions_read on public.task_extensions for select to authenticated
  using (private.is_task_participant(task_id) or private.is_staff());
revoke all on public.task_extensions from anon;
revoke insert, update, delete on public.task_extensions from authenticated;
grant select on public.task_extensions to authenticated;

-- ---------- Отзывы ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  target_id uuid not null references public.profiles (id),
  author_role text not null check (author_role in ('customer', 'executor')),
  rating int not null check (rating between 1 and 5),
  quality int check (quality between 1 and 5),
  communication int check (communication between 1 and 5),
  deadlines int check (deadlines between 1 and 5),
  requirements int check (requirements between 1 and 5),
  public_text text check (char_length(public_text) <= 2000),
  skills_confirmed text[] not null default '{}' check (cardinality(skills_confirmed) <= 30),
  work_again boolean,
  created_at timestamptz not null default now(),
  unique (task_id, author_id)
);
create index reviews_target on public.reviews (target_id, created_at desc);
-- Приватный отзыв видит только команда Parri
create table public.review_private (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  body text not null check (char_length(body) <= 2000)
);
alter table public.reviews enable row level security;
alter table public.review_private enable row level security;
create policy reviews_read on public.reviews for select to anon, authenticated using (true);
create policy review_private_staff on public.review_private for select to authenticated using (private.is_staff());
revoke insert, update, delete on public.reviews, public.review_private from anon, authenticated;
revoke all on public.review_private from anon;
grant select on public.reviews to anon, authenticated;
grant select on public.review_private to authenticated;

-- ---------- Константы ----------
create or replace function private.daily_take_limit() returns int
language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function private.start_window_minutes() returns int
language sql immutable set search_path = '' as $$ select 25 $$;

-- ---------- Взять задачу сразу ----------
create or replace function public.take_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_plan public.plan_id;
  v_taken int;
begin
  if v.customer_id = v_uid then
    raise exception 'own_task' using errcode = '42501';
  end if;
  if v.status <> 'open' or v.expires_at <= now() then
    raise exception 'task_not_open' using errcode = '55000';
  end if;
  if v.kind = 'campus' and v.university_id is distinct from private.my_university_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into v_taken from public.tasks
   where executor_id = v_uid and take_mode = 'instant' and assigned_at > now() - interval '24 hours';
  if v_taken >= private.daily_take_limit() then
    raise exception 'daily_take_limit' using errcode = '54000';
  end if;
  select plan into v_plan from public.profiles where id = v_uid;

  update public.task_responses set status = 'rejected' where task_id = v.id and status = 'pending';
  update public.tasks
     set status = 'in_progress', executor_id = v_uid, take_mode = 'instant', assigned_at = now(), started_at = null,
         due_at = now() + make_interval(mins => private.deadline_minutes(v.deadline) + private.deadline_bonus_minutes(v_plan))
   where id = v.id
  returning * into v;
  perform private.system_message(v.id, 'task_taken', jsonb_build_object('executor_id', v_uid));
  return v;
end $$;

/** Начать выполнение: для взятой сразу задачи — не позже 25 минут после взятия */
create or replace function public.start_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
begin
  if v.executor_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'in_progress' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if v.started_at is not null then
    return v;
  end if;
  if v.take_mode = 'instant' and v.assigned_at < now() - make_interval(mins => private.start_window_minutes()) then
    raise exception 'start_window_passed' using errcode = '55000';
  end if;
  update public.tasks set started_at = now() where id = v.id returning * into v;
  perform private.system_message(v.id, 'work_started', '{}'::jsonb);
  return v;
end $$;

/** Вернуть задачу в ленту (отказ исполнителя или истёкшее окно старта) */
create or replace function private.release_task(v public.tasks, p_event text) returns public.tasks
language plpgsql security definer set search_path = '' as $$
begin
  update public.task_responses set status = 'rejected' where id = v.accepted_response_id;
  update public.tasks
     set status = 'open', executor_id = null, accepted_response_id = null, take_mode = null,
         assigned_at = null, due_at = null, started_at = null,
         expires_at = greatest(expires_at, now() + interval '1 day')
   where id = v.id
  returning * into v;
  perform private.system_message(v.id, p_event, '{}'::jsonb);
  return v;
end $$;

/** Отказаться от задачи: до начала — без штрафа, после — учитывается в надёжности */
create or replace function public.refuse_task(p_task uuid, p_reason text default null) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
begin
  if v.executor_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'in_progress' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if v.started_at is not null then
    update public.profiles set refusals_count = refusals_count + 1 where id = v_uid;
  end if;
  return private.release_task(v, 'executor_refused');
end $$;

/** Обслуживание (по расписанию): взятые сразу, но не начатые за 25 минут задачи возвращаются в ленту */
create or replace function public.expire_takes() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.tasks;
  n int := 0;
begin
  for v in
    select * from public.tasks
     where status = 'in_progress' and take_mode = 'instant' and started_at is null
       and assigned_at < now() - make_interval(mins => private.start_window_minutes())
     for update skip locked
  loop
    perform private.release_task(v, 'take_expired');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Продление срока ----------
create or replace function public.request_extension(p_task uuid, p_minutes int, p_reason text default null)
returns public.task_extensions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_ext public.task_extensions;
begin
  if v.executor_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status not in ('in_progress', 'review') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if exists (select 1 from public.task_extensions where task_id = v.id and status = 'pending') then
    raise exception 'extension_pending' using errcode = '23505';
  end if;
  insert into public.task_extensions (task_id, requested_by, minutes, reason)
  values (v.id, v_uid, p_minutes, nullif(btrim(p_reason), ''))
  returning * into v_ext;
  perform private.system_message(v.id, 'extension_requested', jsonb_build_object('minutes', p_minutes));
  return v_ext;
end $$;

create or replace function public.decide_extension(p_extension uuid, p_accept boolean)
returns public.task_extensions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_ext public.task_extensions;
  v public.tasks;
begin
  select * into v_ext from public.task_extensions where id = p_extension for update;
  if v_ext.id is null then
    raise exception 'extension_not_found' using errcode = 'P0002';
  end if;
  v := private.lock_task(v_ext.task_id);
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_ext.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  update public.task_extensions set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
   where id = v_ext.id returning * into v_ext;
  if p_accept then
    update public.tasks set due_at = greatest(coalesce(due_at, now()), now()) + make_interval(mins => v_ext.minutes) where id = v.id;
  end if;
  perform private.system_message(v.id, case when p_accept then 'extension_accepted' else 'extension_declined' end,
    jsonb_build_object('minutes', v_ext.minutes));
  return v_ext;
end $$;

-- ---------- Чаевые (из рабочей комнаты, до приёмки) ----------
create or replace function public.send_tip(p_task uuid, p_amount_cents bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_tx uuid := gen_random_uuid();
begin
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Чаевые — пока задача в работе, на проверке или после приёмки
  if v.status not in ('in_progress', 'review', 'completed') or v.executor_id is null then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 100000 then
    raise exception 'tip_out_of_range' using errcode = '22023';
  end if;
  perform private.post(v_tx, 'tip', 'available', v_uid, v.id, -p_amount_cents, 'tip', v.currency);
  perform private.post(v_tx, 'tip', 'available', v.executor_id, v.id, p_amount_cents, 'tip', v.currency);
  perform private.system_message(v.id, 'tip_sent', jsonb_build_object('amount_cents', p_amount_cents, 'currency', v.currency));
end $$;

-- ---------- Вопросы ----------
create or replace function public.ask_question(p_task uuid, p_body text, p_parent uuid default null)
returns public.task_questions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks;
  v_parent public.task_questions;
  v_q public.task_questions;
begin
  if not private.can_view_task(p_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v from public.tasks where id = p_task;
  if p_parent is not null then
    -- Отвечает заказчик (или автор вопроса уточняет)
    select * into v_parent from public.task_questions where id = p_parent and task_id = p_task and parent_id is null;
    if v_parent.id is null then
      raise exception 'question_not_found' using errcode = 'P0002';
    end if;
    if v_uid not in (v.customer_id, v_parent.author_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif v.customer_id = v_uid then
    raise exception 'own_task' using errcode = '42501';
  end if;
  insert into public.task_questions (task_id, author_id, parent_id, body)
  values (p_task, v_uid, p_parent, btrim(p_body))
  returning * into v_q;
  return v_q;
end $$;

create or replace function public.delete_question(p_question uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.task_questions set deleted_at = now()
   where id = p_question and author_id = private.require_active_user() and deleted_at is null;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Вопросы с именами авторов (удалённые — без текста)
create or replace function public.task_questions_for(p_task uuid) returns table (
  id uuid, parent_id uuid, author_id uuid, author_name text, author_avatar text, body text,
  deleted boolean, is_customer boolean, created_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select q.id, q.parent_id, q.author_id,
         btrim(coalesce(p.first_name, '') || ' ' || left(coalesce(p.last_name, ''), 1) || case when p.last_name is not null then '.' else '' end),
         p.avatar_url,
         case when q.deleted_at is null then q.body else '' end,
         q.deleted_at is not null,
         q.author_id = t.customer_id,
         q.created_at
    from public.task_questions q
    join public.tasks t on t.id = q.task_id
    join public.profiles p on p.id = q.author_id
   where q.task_id = p_task
   order by coalesce(q.parent_id, q.id), q.parent_id nulls first, q.created_at
$$;

-- ---------- Жалоба ----------
create or replace function public.complain_task(p_task uuid, p_reason public.complaint_reason, p_details text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  if not private.can_view_task(p_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.tasks where id = p_task and customer_id = v_uid) then
    raise exception 'own_task' using errcode = '42501';
  end if;
  insert into public.task_complaints (task_id, reporter_id, reason, details)
  values (p_task, v_uid, p_reason, nullif(btrim(p_details), ''))
  on conflict (task_id, reporter_id) do update set reason = excluded.reason, details = excluded.details;
end $$;

-- ---------- Отклики: просмотр и сравнение (статусы «просмотрен», «сравнивают») ----------
create or replace function public.mark_responses_viewed(p_task uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_task_customer(p_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.task_responses set viewed_at = now() where task_id = p_task and viewed_at is null and status = 'pending';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.set_response_compared(p_response uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_task uuid;
begin
  select task_id into v_task from public.task_responses where id = p_response;
  if v_task is null or not private.is_task_customer(v_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.task_responses set compared = coalesce(p_on, false), viewed_at = coalesce(viewed_at, now()) where id = p_response;
end $$;

-- ---------- Отклик: видео, редактирование ----------
drop function if exists public.submit_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when);
drop function if exists public.update_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when);

create or replace function public.submit_response(
  p_task uuid,
  p_cover_letter text,
  p_price_cents bigint,
  p_deadline public.task_deadline,
  p_skills text[] default '{}',
  p_portfolio_links text[] default '{}',
  p_ready public.ready_when default 'now',
  p_video_url text default null
) returns public.task_responses
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_existing public.task_responses;
  v_resp public.task_responses;
begin
  if v.customer_id = v_uid then
    raise exception 'own_task' using errcode = '42501';
  end if;
  if v.status <> 'open' or v.expires_at <= now() then
    raise exception 'task_not_open' using errcode = '55000';
  end if;
  if v.kind = 'campus' and v.university_id is distinct from private.my_university_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.validate_links(p_portfolio_links);
  if p_video_url is not null and nullif(btrim(p_video_url), '') is not null and p_video_url !~* '^https?://\S+$' then
    raise exception 'invalid_link' using errcode = '22023';
  end if;

  select * into v_existing from public.task_responses where task_id = p_task and executor_id = v_uid for update;
  if v_existing.id is null then
    insert into public.task_responses (task_id, executor_id, cover_letter, price_cents, deadline, skills, portfolio_links, ready, video_url)
    values (p_task, v_uid, btrim(p_cover_letter), p_price_cents, p_deadline,
            coalesce(p_skills, '{}'), coalesce(p_portfolio_links, '{}'), coalesce(p_ready, 'now'), nullif(btrim(p_video_url), ''))
    returning * into v_resp;
    update public.tasks set response_count = response_count + 1 where id = p_task;
  elsif v_existing.status = 'withdrawn' then
    update public.task_responses
       set cover_letter = btrim(p_cover_letter), price_cents = p_price_cents, deadline = p_deadline,
           skills = coalesce(p_skills, '{}'), portfolio_links = coalesce(p_portfolio_links, '{}'),
           ready = coalesce(p_ready, 'now'), video_url = nullif(btrim(p_video_url), ''), status = 'pending',
           viewed_at = null, compared = false
     where id = v_existing.id
    returning * into v_resp;
    update public.tasks set response_count = response_count + 1 where id = p_task;
  else
    raise exception 'already_responded' using errcode = '23505';
  end if;
  return v_resp;
end $$;

create or replace function public.update_response(
  p_response uuid,
  p_cover_letter text,
  p_price_cents bigint,
  p_deadline public.task_deadline,
  p_skills text[] default '{}',
  p_portfolio_links text[] default '{}',
  p_ready public.ready_when default 'now',
  p_video_url text default null
) returns public.task_responses
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_resp public.task_responses;
  v public.tasks;
begin
  select * into v_resp from public.task_responses where id = p_response for update;
  if v_resp.id is null or v_resp.executor_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v := private.lock_task(v_resp.task_id);
  if v_resp.status <> 'pending' or v.status <> 'open' then
    raise exception 'response_locked' using errcode = '55000';
  end if;
  perform private.validate_links(p_portfolio_links);
  update public.task_responses
     set cover_letter = btrim(p_cover_letter), price_cents = p_price_cents, deadline = p_deadline,
         skills = coalesce(p_skills, '{}'), portfolio_links = coalesce(p_portfolio_links, '{}'),
         ready = coalesce(p_ready, 'now'), video_url = nullif(btrim(p_video_url), '')
   where id = p_response
  returning * into v_resp;
  return v_resp;
end $$;

-- При выборе по отклику исполнитель уже согласился — работа считается начатой
create or replace function private.mark_response_take() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'in_progress' and old.status = 'open' and new.accepted_response_id is not null then
    new.take_mode := 'response';
    new.started_at := coalesce(new.started_at, now());
  end if;
  return new;
end $$;
create trigger tasks_mark_response_take before update on public.tasks
  for each row execute function private.mark_response_take();

-- ---------- Сдача: этап, что включено, комментарий ----------
drop function if exists public.submit_work(uuid, text, text, jsonb);
create or replace function public.submit_work(
  p_task uuid,
  p_link text default null,
  p_comment text default null,
  p_files jsonb default '[]',
  p_stage text default 'final',
  p_included text[] default '{}',
  p_note text default null
) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_files jsonb;
  v_version int;
  v_sub public.submissions;
begin
  if v.executor_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'in_progress' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  v_files := private.validate_files(p_files, v_uid::text || '/' || p_task::text || '/submission/');
  if nullif(btrim(p_link), '') is null and jsonb_array_length(v_files) = 0 and nullif(btrim(p_comment), '') is null then
    raise exception 'empty_submission' using errcode = '22023';
  end if;
  if nullif(btrim(p_link), '') is not null and p_link !~* '^https?://\S+$' then
    raise exception 'invalid_link' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.submissions where task_id = p_task;
  insert into public.submissions (task_id, executor_id, version, link, comment, files, stage, included, note)
  values (p_task, v_uid, v_version, nullif(btrim(p_link), ''), nullif(btrim(p_comment), ''), v_files,
          coalesce(p_stage, 'final'), coalesce(p_included, '{}'), nullif(btrim(p_note), ''))
  returning * into v_sub;

  update public.tasks set status = 'review', started_at = coalesce(started_at, now()) where id = p_task;
  perform private.system_message(p_task, 'work_submitted', jsonb_build_object('version', v_version, 'stage', v_sub.stage));
  return v_sub;
end $$;

-- ---------- Приёмка: доработка с пунктами и новым сроком; спор — на Pro ----------
drop function if exists public.review_submission(uuid, text, boolean[], text);
create or replace function public.review_submission(
  p_submission uuid,
  p_decision text,
  p_checklist boolean[] default '{}',
  p_comment text default null,
  p_revision_items int[] default null,
  p_revision_criteria text[] default null,
  p_revision_due timestamptz default null
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_sub public.submissions;
  v public.tasks;
  v_latest int;
  v_escrow bigint;
  v_tx uuid := gen_random_uuid();
  v_plan public.plan_id;
begin
  select * into v_sub from public.submissions where id = p_submission for update;
  if v_sub.id is null then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  v := private.lock_task(v_sub.task_id);
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select max(version) into v_latest from public.submissions where task_id = v.id;
  if v.status <> 'review' or v_sub.status <> 'pending' or v_sub.version <> v_latest then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_decision not in ('accept', 'revision', 'dispute') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  if p_decision = 'accept' then
    if cardinality(v.checklist) > 0 and (
      coalesce(cardinality(p_checklist), 0) <> cardinality(v.checklist)
      or array_position(p_checklist, false) is not null
      or array_position(p_checklist, null) is not null
    ) then
      raise exception 'checklist_incomplete' using errcode = '22023';
    end if;
    select balance_cents into v_escrow from public.escrow_accounts where task_id = v.id for update;
    if v_escrow is distinct from v.reward_cents + v.fee_cents then
      raise exception 'escrow_mismatch' using errcode = 'P0001';
    end if;
    perform private.post(v_tx, 'task_release', 'escrow', v.customer_id, v.id, -v_escrow, 'accept', v.currency);
    perform private.post(v_tx, 'task_release', 'available', v.executor_id, v.id, v.reward_cents, 'reward', v.currency);
    perform private.post(v_tx, 'task_release', 'platform_revenue', null, v.id, v.fee_cents, 'fee', v.currency);
    update public.submissions
       set status = 'accepted', checklist_result = p_checklist, review_comment = nullif(btrim(p_comment), ''), reviewed_at = now()
     where id = v_sub.id;
    update public.tasks set status = 'completed', completed_at = now() where id = v.id returning * into v;
    update public.profiles
       set completed_count = completed_count + 1,
           earned_cents = earned_cents + case when v.currency = 'USD' then v.reward_cents else 0 end
     where id = v.executor_id;
    perform private.system_message(v.id, 'work_accepted', jsonb_build_object('reward_cents', v.reward_cents, 'tx', v_tx));
  else
    if char_length(btrim(coalesce(p_comment, ''))) < 10 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    if p_decision = 'revision' then
      if p_revision_due is not null and p_revision_due <= now() then
        raise exception 'invalid_due' using errcode = '22023';
      end if;
      update public.submissions
         set status = 'revision_requested', checklist_result = p_checklist, review_comment = btrim(p_comment), reviewed_at = now(),
             revision_items = p_revision_items, revision_criteria = p_revision_criteria, revision_due = p_revision_due
       where id = v_sub.id;
      update public.tasks set status = 'in_progress', due_at = coalesce(p_revision_due, greatest(due_at, now() + interval '1 hour'))
       where id = v.id returning * into v;
      perform private.system_message(v.id, 'revision_requested', jsonb_build_object('version', v_sub.version, 'due', p_revision_due));
    else
      -- Спор с модератором — на тарифе Pro (Max на сайте пока не делаем)
      select plan into v_plan from public.profiles where id = v_uid;
      if v_plan <> 'pro' then
        raise exception 'dispute_requires_pro' using errcode = '42501';
      end if;
      update public.submissions
         set status = 'disputed', checklist_result = p_checklist, review_comment = btrim(p_comment), reviewed_at = now()
       where id = v_sub.id;
      update public.tasks set status = 'disputed' where id = v.id returning * into v;
      insert into public.disputes (task_id, submission_id, opened_by, reason) values (v.id, v_sub.id, v_uid, btrim(p_comment));
      perform private.system_message(v.id, 'dispute_opened', '{}'::jsonb);
    end if;
  end if;
  return v;
end $$;

-- ---------- Отзыв после оплаты (изменить потом нельзя) ----------
create or replace function public.leave_review(
  p_task uuid,
  p_rating int,
  p_quality int default null,
  p_communication int default null,
  p_deadlines int default null,
  p_requirements int default null,
  p_public text default null,
  p_private text default null,
  p_skills text[] default '{}',
  p_work_again boolean default null
) returns public.reviews
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks;
  v_target uuid;
  v_role text;
  v_r public.reviews;
begin
  select * into v from public.tasks where id = p_task;
  if v.id is null or v_uid not in (v.customer_id, coalesce(v.executor_id, v.customer_id)) or v.executor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'completed' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  v_role := case when v_uid = v.customer_id then 'customer' else 'executor' end;
  v_target := case when v_role = 'customer' then v.executor_id else v.customer_id end;
  if exists (select 1 from public.reviews where task_id = p_task and author_id = v_uid) then
    raise exception 'already_reviewed' using errcode = '23505';
  end if;
  insert into public.reviews (task_id, author_id, target_id, author_role, rating, quality, communication, deadlines,
                              requirements, public_text, skills_confirmed, work_again)
  values (p_task, v_uid, v_target, v_role, p_rating, p_quality, p_communication, p_deadlines, p_requirements,
          nullif(btrim(p_public), ''), coalesce(p_skills, '{}'), p_work_again)
  returning * into v_r;
  if nullif(btrim(p_private), '') is not null then
    insert into public.review_private (review_id, body) values (v_r.id, btrim(p_private));
  end if;
  update public.profiles p
     set rating_count = s.n, rating_avg = s.avg
    from (select count(*)::int as n, round(avg(rating)::numeric, 2) as avg from public.reviews where target_id = v_target) s
   where p.id = v_target;
  return v_r;
end $$;

-- ---------- Лента: пропущенные скрыты, закладки, совпадение навыков, новые фильтры и сортировки ----------
drop function if exists public.feed_tasks(public.task_kind, text, public.task_category[], bigint, bigint,
  public.task_deadline[], double precision, double precision, integer, text, integer, integer);

create or replace function public.feed_tasks(
  p_kind public.task_kind default 'online',
  p_query text default null,
  p_categories public.task_category[] default null,
  p_min_reward bigint default null,
  p_max_reward bigint default null,
  p_deadlines public.task_deadline[] default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_distance_m int default null,
  p_sort text default 'recommended',
  p_limit int default 20,
  p_offset int default 0,
  p_levels public.experience_level[] default null,
  p_language text default null,
  p_bookmarked boolean default false,
  p_max_minutes int default null
) returns table (
  id uuid,
  title text,
  brief text,
  category public.task_category,
  result_format public.result_format,
  deadline public.task_deadline,
  kind public.task_kind,
  reward_cents bigint,
  currency public.money_currency,
  university_name text,
  place_name text,
  radius_m int,
  distance_m double precision,
  lat double precision,
  lng double precision,
  response_count int,
  published_at timestamptz,
  expires_at timestamptz,
  customer_id uuid,
  customer_name text,
  customer_avatar text,
  customer_rating numeric,
  has_responded boolean,
  bookmarked boolean,
  match int,
  required_level public.experience_level,
  language text,
  proofs text[]
)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select auth.uid() as uid,
           case when p_lat is not null and p_lng is not null
                then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
           end as point,
           coalesce((select array_agg(distinct s.category) from public.profile_skills ps join public.skills s on s.slug = ps.skill_slug
                      where ps.profile_id = auth.uid()), '{}') as categories,
           coalesce((select array_agg(ps.skill_slug) from public.profile_skills ps where ps.profile_id = auth.uid()), '{}') as skills
  ),
  base as (
    select t.*, p.first_name, p.last_name, p.avatar_url, p.rating_avg, u.name as uni_name,
           case when me.point is not null and t.location is not null then extensions.st_distance(t.location, me.point) end as dist,
           me.categories, me.uid,
           exists (select 1 from public.task_bookmarks b where b.task_id = t.id and b.user_id = me.uid) as is_bookmarked,
           -- Совпадение с навыками: категория своя → 60, плюс доля совпавших навыков задачи → до 40
           least(100, (case when t.category = any (me.categories) then 60 else 0 end)
             + case when cardinality(t.skills) > 0
                    then (40 * cardinality(array(select unnest(t.skills) intersect select unnest(me.skills))) / cardinality(t.skills))
                    else case when t.category = any (me.categories) then 20 else 0 end end)::int as match_score
      from public.tasks t
      cross join me
      join public.profiles p on p.id = t.customer_id
      left join public.universities u on u.id = t.university_id
     where t.status = 'open'
       and t.expires_at > now()
       and t.kind = p_kind
       and t.customer_id <> me.uid
       and not exists (select 1 from public.task_skips sk where sk.task_id = t.id and sk.user_id = me.uid)
       and (not coalesce(p_bookmarked, false) or exists (select 1 from public.task_bookmarks b where b.task_id = t.id and b.user_id = me.uid))
       and (p_kind <> 'nearby' or me.point is not null)
       and (p_query is null or btrim(p_query) = '' or t.title ilike '%' || btrim(p_query) || '%'
            or t.brief ilike '%' || btrim(p_query) || '%'
            or btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || btrim(p_query) || '%')
       and (p_categories is null or cardinality(p_categories) = 0 or t.category = any (p_categories))
       and (p_min_reward is null or t.reward_cents >= p_min_reward)
       and (p_max_reward is null or t.reward_cents <= p_max_reward)
       and (p_deadlines is null or cardinality(p_deadlines) = 0 or t.deadline = any (p_deadlines))
       and (p_levels is null or cardinality(p_levels) = 0 or t.required_level is null or t.required_level = any (p_levels))
       and (p_language is null or t.language is null or t.language = p_language)
       and (p_max_minutes is null or private.deadline_minutes(t.deadline) <= p_max_minutes)
       and (p_max_distance_m is null or me.point is null or t.location is null
            or extensions.st_dwithin(t.location, me.point, p_max_distance_m))
  )
  select b.id, b.title, b.brief, b.category, b.result_format, b.deadline, b.kind, b.reward_cents, b.currency,
         b.uni_name, b.place_name, b.radius_m, b.dist,
         extensions.st_y(b.location::extensions.geometry), extensions.st_x(b.location::extensions.geometry),
         b.response_count, b.published_at, b.expires_at, b.customer_id,
         btrim(coalesce(b.first_name, '') || ' ' || left(coalesce(b.last_name, ''), 1) ||
               case when b.last_name is not null then '.' else '' end),
         b.avatar_url, b.rating_avg,
         private.has_responded(b.id),
         b.is_bookmarked,
         b.match_score,
         b.required_level, b.language, b.proofs
    from base b
   order by
     case when p_sort = 'recommended' then
       b.match_score / 30.0
       + greatest(0, 2 - extract(epoch from now() - b.published_at) / 86400.0)
       + ln(b.reward_cents / 100.0 + 1) / 2
       - coalesce(b.dist / 1000.0, 0)
     end desc nulls last,
     case when p_sort = 'best_match' then b.match_score end desc nulls last,
     case when p_sort = 'highest_pay' then b.reward_cents end desc nulls last,
     case when p_sort = 'deadline' then private.deadline_minutes(b.deadline) end asc nulls last,
     case when p_sort = 'distance' then b.dist end asc nulls last,
     b.published_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------- Карточка задачи: всё для страницы задачи и рабочей комнаты ----------
create or replace function public.task_detail(p_task uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v public.tasks;
  v_uid uuid := auth.uid();
  v_role text;
  v_result jsonb;
begin
  select * into v from public.tasks where id = p_task;
  if v.id is null then
    return null;
  end if;
  v_role := case
    when v.customer_id = v_uid then 'customer'
    when v.executor_id = v_uid then 'executor'
    when private.has_responded(v.id) then 'candidate'
    else 'visitor' end;

  select jsonb_build_object(
    'task', to_jsonb(v) - 'location'
      || jsonb_build_object(
        'lat', extensions.st_y(v.location::extensions.geometry),
        'lng', extensions.st_x(v.location::extensions.geometry),
        'expired', v.status = 'open' and v.expires_at <= now()
      ),
    'viewer_role', v_role,
    'customer', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
                   'avatar_url', p.avatar_url, 'rating_avg', p.rating_avg, 'rating_count', p.rating_count,
                   'completed_count', p.completed_count, 'created_at', p.created_at, 'username', p.username,
                   'customer_completed', (select count(*) from public.tasks x where x.customer_id = p.id and x.status = 'completed'),
                   'customer_open', (select count(*) from public.tasks x where x.customer_id = p.id and x.status = 'open' and x.expires_at > now()))
                   from public.profiles p where p.id = v.customer_id),
    'executor', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
                   'avatar_url', p.avatar_url, 'rating_avg', p.rating_avg, 'rating_count', p.rating_count,
                   'completed_count', p.completed_count, 'username', p.username)
                   from public.profiles p where p.id = v.executor_id),
    'university', (select jsonb_build_object('id', u.id, 'name', u.name) from public.universities u where u.id = v.university_id),
    'attachments', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.task_attachments a where a.task_id = v.id), '[]'),
    'my_response', (select to_jsonb(r) from public.task_responses r where r.task_id = v.id and r.executor_id = v_uid),
    'submissions', coalesce((select jsonb_agg(to_jsonb(s) order by s.version desc) from public.submissions s where s.task_id = v.id), '[]'),
    'dispute', (select to_jsonb(d) from public.disputes d where d.task_id = v.id order by d.created_at desc limit 1),
    'bookmarked', exists (select 1 from public.task_bookmarks b where b.task_id = v.id and b.user_id = v_uid),
    'questions_count', (select count(*) from public.task_questions q where q.task_id = v.id and q.parent_id is null and q.deleted_at is null),
    'extension', (select to_jsonb(e) from public.task_extensions e where e.task_id = v.id order by e.created_at desc limit 1),
    'my_review', (select to_jsonb(r) from public.reviews r where r.task_id = v.id and r.author_id = v_uid),
    'takes_left', private.daily_take_limit() - (select count(*) from public.tasks x
                    where x.executor_id = v_uid and x.take_mode = 'instant' and x.assigned_at > now() - interval '24 hours'),
    'start_deadline', case when v.take_mode = 'instant' and v.started_at is null and v.assigned_at is not null
                           then v.assigned_at + make_interval(mins => private.start_window_minutes()) end
  ) into v_result;
  return v_result;
end $$;

-- ---------- Отклики для заказчика: просмотр и сравнение ----------
drop function if exists public.task_responses_for(uuid);
create or replace function public.task_responses_for(p_task uuid) returns table (
  id uuid,
  executor_id uuid,
  cover_letter text,
  price_cents bigint,
  deadline public.task_deadline,
  skills text[],
  portfolio_links text[],
  ready public.ready_when,
  status public.response_status,
  created_at timestamptz,
  first_name text,
  last_name text,
  avatar_url text,
  rating_avg numeric,
  rating_count int,
  completed_count int,
  video_url text,
  viewed_at timestamptz,
  compared boolean,
  match int,
  username text
)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.executor_id, r.cover_letter, r.price_cents, r.deadline, r.skills, r.portfolio_links,
         r.ready, r.status, r.created_at,
         p.first_name, p.last_name, p.avatar_url, p.rating_avg, p.rating_count, p.completed_count,
         r.video_url, r.viewed_at, r.compared,
         (case when exists (select 1 from public.profile_skills ps join public.skills s on s.slug = ps.skill_slug
                             where ps.profile_id = r.executor_id and s.category = t.category) then 60 else 0 end
          + least(40, 10 * coalesce(p.completed_count, 0)))::int,
         p.username
    from public.task_responses r
    join public.tasks t on t.id = r.task_id
    join public.profiles p on p.id = r.executor_id
   where r.task_id = p_task
     and private.is_task_customer(p_task)
     and r.status <> 'withdrawn'
   order by (r.status = 'accepted') desc, (r.status = 'pending') desc, r.created_at
$$;

-- ---------- Мои задачи: больше полей для вкладок ----------
drop function if exists public.my_tasks(text);
create or replace function public.my_tasks(p_role text default 'customer') returns table (
  id uuid,
  title text,
  category public.task_category,
  kind public.task_kind,
  deadline public.task_deadline,
  reward_cents bigint,
  fee_cents bigint,
  currency public.money_currency,
  status public.task_status,
  archive_reason public.archive_reason,
  expired boolean,
  response_count int,
  new_responses int,
  due_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  assigned_at timestamptz,
  started_at timestamptz,
  take_mode text,
  counterpart_id uuid,
  counterpart_name text,
  my_response_status public.response_status,
  reviewed boolean
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.title, t.category, t.kind, t.deadline, t.reward_cents, t.fee_cents, t.currency, t.status,
         t.archive_reason, (t.status = 'open' and t.expires_at <= now()),
         t.response_count,
         (select count(*)::int from public.task_responses x where x.task_id = t.id and x.status = 'pending' and x.viewed_at is null
            and t.customer_id = auth.uid()),
         t.due_at, t.expires_at, t.published_at, t.completed_at, t.assigned_at, t.started_at, t.take_mode,
         p.id,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         r.status,
         exists (select 1 from public.reviews rv where rv.task_id = t.id and rv.author_id = auth.uid())
    from public.tasks t
    left join public.profiles p
      on p.id = case when p_role = 'customer' then t.executor_id else t.customer_id end
    left join public.task_responses r on r.task_id = t.id and r.executor_id = auth.uid()
   where (p_role = 'customer' and t.customer_id = auth.uid())
      or (p_role = 'executor' and (t.executor_id = auth.uid()
          or (r.id is not null and r.status in ('pending', 'rejected'))))
   order by coalesce(t.due_at, t.published_at) desc
$$;

-- ---------- Публикация: дополнительные поля задачи (язык, уровень, доказательства, окно посещения, корпус, навыки) ----------
drop function if exists public.publish_task(uuid, text, text, public.task_category, public.result_format, public.task_deadline,
  public.task_kind, bigint, text, text[], double precision, double precision, integer, text, jsonb, public.money_currency, text, bigint, timestamptz);

create or replace function public.publish_task(
  p_id uuid,
  p_title text,
  p_brief text,
  p_category public.task_category,
  p_result_format public.result_format,
  p_deadline public.task_deadline,
  p_kind public.task_kind,
  p_reward_cents bigint,
  p_description text default null,
  p_checklist text[] default '{}',
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m int default null,
  p_place_name text default null,
  p_attachments jsonb default '[]',
  p_currency public.money_currency default 'USD',
  p_input_currency text default null,
  p_input_amount bigint default null,
  p_rate_fetched_at timestamptz default null,
  p_extra jsonb default '{}'
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_profile public.profiles;
  v_fee_bps int;
  v_fee bigint;
  v_university bigint;
  v_location extensions.geography;
  v_task public.tasks;
  v_tx uuid := gen_random_uuid();
  v_files jsonb;
  v_item text;
  v_rate public.fx_rates;
begin
  -- Повторное нажатие (медленная сеть): та же задача, деньги второй раз не списываются
  select * into v_task from public.tasks where id = p_id;
  if v_task.id is not null then
    if v_task.customer_id = v_uid then
      return v_task;
    end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  if p_reward_cents is null or p_reward_cents < 100 or p_reward_cents > 1000000 then
    raise exception 'reward_out_of_range' using errcode = '22023';
  end if;

  -- Цена в рублях: пересчёт по курсу ЦБ. Если курс обновился после того, как форма его показала, —
  -- просим подтвердить новую сумму.
  if p_input_currency = 'RUB' then
    select * into v_rate from public.fx_rates where currency = 'RUB';
    if p_rate_fetched_at is null or date_trunc('second', v_rate.fetched_at) <> date_trunc('second', p_rate_fetched_at) then
      raise exception 'rate_changed' using errcode = '40001';
    end if;
    if p_input_amount is null or round(p_input_amount / v_rate.per_usd) <> p_reward_cents then
      raise exception 'rate_changed' using errcode = '40001';
    end if;
  end if;

  foreach v_item in array coalesce(p_checklist, '{}') loop
    if char_length(btrim(v_item)) not between 1 and 200 then
      raise exception 'invalid_checklist' using errcode = '22023';
    end if;
  end loop;

  if p_kind = 'campus' then
    v_university := v_profile.university_id;
    if v_university is null then
      raise exception 'university_required' using errcode = '22023';
    end if;
  end if;

  if p_kind = 'nearby' then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'location_required' using errcode = '22023';
    end if;
    if p_radius_m is null or p_radius_m not in (100, 250, 500) then
      raise exception 'invalid_radius' using errcode = '22023';
    end if;
    v_location := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  v_files := private.validate_files(p_attachments, v_uid::text || '/' || p_id::text || '/brief/');

  v_fee_bps := public.fee_bps_for_reward(p_reward_cents);
  v_fee := public.calc_fee(p_reward_cents, v_fee_bps);

  insert into public.tasks (
    id, customer_id, title, brief, description, category, result_format, checklist, deadline, kind,
    university_id, location, radius_m, place_name, reward_cents, fee_bps, fee_cents, status, expires_at,
    currency, input_currency, input_amount,
    language, required_level, proofs, visit_window, campus_building, skills
  ) values (
    p_id, v_uid, btrim(p_title), btrim(p_brief), nullif(btrim(p_description), ''), p_category,
    p_result_format, coalesce(p_checklist, '{}'), p_deadline, p_kind, v_university, v_location,
    case when p_kind = 'nearby' then p_radius_m end,
    case when p_kind = 'nearby' then nullif(btrim(p_place_name), '') end,
    p_reward_cents, v_fee_bps, v_fee, 'open', now() + interval '7 days',
    p_currency, coalesce(p_input_currency, p_currency::text), coalesce(p_input_amount, p_reward_cents),
    nullif(p_extra ->> 'language', ''),
    nullif(p_extra ->> 'required_level', '')::public.experience_level,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_extra -> 'proofs', '[]')) x), '{}'),
    case when p_kind = 'nearby' then nullif(btrim(p_extra ->> 'visit_window'), '') end,
    case when p_kind = 'campus' then nullif(btrim(p_extra ->> 'campus_building'), '') end,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_extra -> 'skills', '[]')) x), '{}')
  ) returning * into v_task;

  insert into public.task_attachments (task_id, path, name, size_bytes, mime)
  select v_task.id, f ->> 'path', f ->> 'name', (f ->> 'size')::bigint, f ->> 'mime'
    from jsonb_array_elements(v_files) f;

  -- Сейф: награда + комиссия уходят с баланса заказчика в валюте задачи
  perform private.post(v_tx, 'task_lock', 'available', v_uid, v_task.id, -(p_reward_cents + v_fee), 'publish', p_currency);
  perform private.post(v_tx, 'task_lock', 'escrow', v_uid, v_task.id, p_reward_cents + v_fee, 'publish', p_currency);

  return v_task;
end $$;

-- ---------- Права ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.take_task(uuid)', 'public.start_task(uuid)', 'public.refuse_task(uuid, text)',
    'public.request_extension(uuid, integer, text)', 'public.decide_extension(uuid, boolean)',
    'public.send_tip(uuid, bigint)', 'public.ask_question(uuid, text, uuid)', 'public.delete_question(uuid)',
    'public.task_questions_for(uuid)', 'public.complain_task(uuid, public.complaint_reason, text)',
    'public.mark_responses_viewed(uuid)', 'public.set_response_compared(uuid, boolean)',
    'public.submit_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when, text)',
    'public.update_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when, text)',
    'public.submit_work(uuid, text, text, jsonb, text, text[], text)',
    'public.review_submission(uuid, text, boolean[], text, integer[], text[], timestamptz)',
    'public.leave_review(uuid, integer, integer, integer, integer, integer, text, text, text[], boolean)',
    'public.feed_tasks(public.task_kind, text, public.task_category[], bigint, bigint, public.task_deadline[], double precision, double precision, integer, text, integer, integer, public.experience_level[], text, boolean, integer)',
    'public.task_detail(uuid)', 'public.task_responses_for(uuid)', 'public.my_tasks(text)',
    'public.publish_task(uuid, text, text, public.task_category, public.result_format, public.task_deadline, public.task_kind, bigint, text, text[], double precision, double precision, integer, text, jsonb, public.money_currency, text, bigint, timestamptz, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.expire_takes() from public, anon, authenticated;
grant execute on function public.expire_takes() to service_role;
revoke all on function private.release_task(public.tasks, text), private.mark_response_take() from public;
