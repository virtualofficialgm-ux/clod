-- Parri · задачи, отклики, сдачи, чат рабочей комнаты, споры, сохранённые поиски.
-- Клиенты только читают эти таблицы (RLS); все изменения состояния — через RPC (миграция 0004).

create type public.task_status as enum ('open', 'in_progress', 'review', 'disputed', 'completed', 'archived');
create type public.archive_reason as enum ('expired', 'cancelled');
create type public.response_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type public.ready_when as enum ('now', 'in_1h', 'today', 'tomorrow');
create type public.submission_status as enum ('pending', 'accepted', 'revision_requested', 'disputed');
create type public.message_kind as enum ('text', 'system');
create type public.dispute_status as enum ('pending', 'in_progress', 'resolved', 'rejected');

-- ---------- Задачи ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  brief text not null check (char_length(btrim(brief)) between 1 and 400),
  description text check (char_length(description) <= 4000),
  category public.task_category not null,
  result_format public.result_format not null,
  checklist text[] not null default '{}' check (cardinality(checklist) <= 10),
  deadline public.task_deadline not null,
  kind public.task_kind not null,
  university_id bigint references public.universities (id),
  location extensions.geography(point, 4326),
  radius_m int check (radius_m in (100, 250, 500)),
  place_name text check (char_length(place_name) <= 120),
  reward_cents bigint not null check (reward_cents between 100 and 1000000),
  fee_bps int not null check (fee_bps between 0 and 10000),
  fee_cents bigint not null check (fee_cents >= 0),
  status public.task_status not null default 'open',
  archive_reason public.archive_reason,
  executor_id uuid references public.profiles (id),
  accepted_response_id uuid,
  assigned_at timestamptz,
  due_at timestamptz,
  expires_at timestamptz not null,
  published_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campus_requires_university check (kind <> 'campus' or university_id is not null),
  constraint nearby_requires_location check (
    kind <> 'nearby' or (location is not null and radius_m is not null)
  ),
  constraint executor_not_customer check (executor_id is null or executor_id <> customer_id),
  constraint archived_has_reason check ((status = 'archived') = (archive_reason is not null))
);
create index tasks_open_feed on public.tasks (kind, published_at desc) where status = 'open';
create index tasks_customer on public.tasks (customer_id, created_at desc);
create index tasks_executor on public.tasks (executor_id, created_at desc);
create index tasks_title_trgm on public.tasks using gin (title extensions.gin_trgm_ops);
create index tasks_location on public.tasks using gist (location);
create index tasks_expiry on public.tasks (expires_at) where status = 'open';
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  path text not null,
  name text not null check (char_length(name) <= 200),
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  mime text not null check (char_length(mime) <= 120),
  created_at timestamptz not null default now()
);
create index task_attachments_task on public.task_attachments (task_id);

-- ---------- Отклики ----------
create table public.task_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  executor_id uuid not null references public.profiles (id),
  cover_letter text not null check (char_length(btrim(cover_letter)) between 20 and 2000),
  price_cents bigint not null check (price_cents between 100 and 1000000),
  deadline public.task_deadline not null,
  skills text[] not null default '{}' check (cardinality(skills) <= 10),
  portfolio_links text[] not null default '{}' check (cardinality(portfolio_links) <= 5),
  ready public.ready_when not null default 'now',
  status public.response_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, executor_id)
);
create index task_responses_executor on public.task_responses (executor_id, created_at desc);
create trigger task_responses_touch before update on public.task_responses
  for each row execute function private.touch_updated_at();

alter table public.tasks
  add constraint tasks_accepted_response_fk
  foreign key (accepted_response_id) references public.task_responses (id);

-- ---------- Сдачи (история версий) ----------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  executor_id uuid not null references public.profiles (id),
  version int not null check (version >= 1),
  link text check (link ~* '^https?://' and char_length(link) <= 1000),
  comment text check (char_length(comment) <= 2000),
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  status public.submission_status not null default 'pending',
  checklist_result boolean[],
  review_comment text check (char_length(review_comment) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, version)
);

-- ---------- Сообщения рабочей комнаты ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  kind public.message_kind not null default 'text',
  body text not null default '' check (char_length(body) <= 4000),
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint text_has_sender check (kind = 'system' or sender_id is not null),
  constraint not_empty check (char_length(btrim(body)) > 0 or jsonb_array_length(files) > 0)
);
create index messages_task on public.messages (task_id, created_at);

-- ---------- Споры (минимум для этапа 3, расширяется на этапе 6) ----------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id),
  account_id uuid references public.profiles (id),
  submission_id uuid references public.submissions (id),
  opened_by uuid not null references public.profiles (id),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  status public.dispute_status not null default 'pending',
  resolution text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dispute_target check (task_id is not null or account_id is not null)
);

-- ---------- Сохранённые поиски ----------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  params jsonb not null check (jsonb_typeof(params) = 'object'),
  created_at timestamptz not null default now()
);
create index saved_searches_user on public.saved_searches (user_id, created_at desc);

-- ---------- Хелперы видимости (security definer, чтобы политики не зацикливались) ----------
create or replace function private.is_task_customer(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks where id = p_task and customer_id = auth.uid())
$$;

create or replace function private.is_task_participant(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks
    where id = p_task and executor_id is not null
      and auth.uid() in (customer_id, executor_id)
  )
$$;

create or replace function private.has_responded(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.task_responses where task_id = p_task and executor_id = auth.uid()
  )
$$;

create or replace function private.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and (
      t.customer_id = auth.uid()
      or t.executor_id = auth.uid()
      or (t.status = 'open' and (t.kind <> 'campus' or t.university_id = private.my_university_id()))
      or private.has_responded(t.id)
      or private.is_staff()
    )
  )
$$;

-- ---------- RLS ----------
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_responses enable row level security;
alter table public.submissions enable row level security;
alter table public.messages enable row level security;
alter table public.disputes enable row level security;
alter table public.saved_searches enable row level security;

-- Задачи: открытые видят все вошедшие (вузовские — только студенты того же вуза),
-- остальные — участники, откликнувшиеся и модераторы
create policy tasks_read on public.tasks for select to authenticated using (
  customer_id = auth.uid()
  or executor_id = auth.uid()
  or (status = 'open' and (kind <> 'campus' or university_id = private.my_university_id()))
  or private.has_responded(id)
  or private.is_staff()
);

create policy task_attachments_read on public.task_attachments for select to authenticated
  using (private.can_view_task(task_id));

-- Отклик видит его автор и заказчик задачи (отозванные заказчику не показываются)
create policy task_responses_read on public.task_responses for select to authenticated using (
  executor_id = auth.uid()
  or (status <> 'withdrawn' and private.is_task_customer(task_id))
  or private.is_staff()
);

create policy submissions_read on public.submissions for select to authenticated
  using (private.is_task_participant(task_id) or private.is_staff());

create policy messages_read on public.messages for select to authenticated
  using (private.is_task_participant(task_id) or private.is_staff());
-- Писать в чат можно только от своего имени, пока задача в работе
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and kind = 'text'
  and meta is null
  and private.is_task_participant(task_id)
  and exists (
    select 1 from public.tasks t
    where t.id = task_id and t.status in ('in_progress', 'review', 'disputed')
  )
);

create policy disputes_read on public.disputes for select to authenticated using (
  opened_by = auth.uid()
  or account_id = auth.uid()
  or (task_id is not null and private.is_task_participant(task_id))
  or private.is_staff()
);

create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Прямые изменения запрещены везде, кроме чата и сохранённых поисков
revoke insert, update, delete on public.tasks, public.task_attachments, public.task_responses,
  public.submissions, public.disputes from anon, authenticated;
revoke update, delete on public.messages from anon, authenticated;
revoke all on public.messages, public.saved_searches from anon;
revoke all on public.tasks, public.task_attachments, public.task_responses,
  public.submissions, public.disputes from anon;
grant select on public.tasks, public.task_attachments, public.task_responses,
  public.submissions, public.disputes to authenticated;

revoke all on all functions in schema private from public;
grant execute on function private.is_staff(), private.my_university_id(),
  private.is_task_customer(uuid), private.is_task_participant(uuid),
  private.has_responded(uuid), private.can_view_task(uuid)
  to anon, authenticated, service_role;

-- Realtime: чат и статусы задач
alter publication supabase_realtime add table public.messages, public.tasks;
