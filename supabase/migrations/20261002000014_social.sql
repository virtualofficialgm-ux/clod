-- Этап «люди»: подписки, контакты, блокировки, приглашения в задачу, уведомления,
-- личные сообщения, «печатает», приватность, деактивация и удаление аккаунта,
-- поиск людей и публичный профиль.

-- ---------- Профиль: приватность и жизненный цикл аккаунта ----------
alter table public.profiles
  add column privacy jsonb not null default '{}' check (jsonb_typeof(privacy) = 'object'),
  add column verified_at timestamptz,
  add column last_seen_at timestamptz,
  add column deactivated_at timestamptz,
  add column deleted_at timestamptz;

alter table public.profile_private
  add column deactivation_reason text check (char_length(deactivation_reason) <= 300);

-- Деактивированные и удалённые не видны другим
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon, authenticated
  using ((banned_at is null and deactivated_at is null and deleted_at is null) or id = auth.uid() or private.is_staff());

/** Настройка приватности с значением по умолчанию */
create or replace function private.privacy_value(p_privacy jsonb, p_key text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(p_privacy ->> p_key, case
    when p_key in ('search_engines', 'university', 'recommendations') then 'true'
    else 'all' end)
$$;

-- Вход доступен деактивированным только для восстановления
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
  if v_profile.id is null or v_profile.banned_at is not null or v_profile.deleted_at is not null then
    raise exception 'account_blocked' using errcode = '42501';
  end if;
  if v_profile.deactivated_at is not null then
    raise exception 'account_deactivated' using errcode = '42501';
  end if;
  if v_profile.onboarding <> 'done' then
    raise exception 'onboarding_incomplete' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- ---------- Связи ----------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id);

-- Контакт — взаимный: пара хранится упорядоченно (user_a < user_b)
create table public.contacts (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index contacts_b on public.contacts (user_b);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.task_invitations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 1000),
  respond_by timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index task_invitations_one_pending on public.task_invitations (task_id, to_id) where status = 'pending';
create index task_invitations_to on public.task_invitations (to_id, created_at desc);

-- ---------- Уведомления ----------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  actor_id uuid references public.profiles (id) on delete set null,
  task_id uuid references public.tasks (id) on delete cascade,
  payload jsonb not null default '{}',
  -- Подбор по навыкам: Pro видят сразу, остальные — через 10 минут
  visible_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, visible_at desc);

create table public.push_tokens (
  token text primary key check (char_length(token) <= 300),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

-- ---------- Личные сообщения ----------
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index direct_messages_pair on public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index direct_messages_recipient on public.direct_messages (recipient_id, read_at);

-- «Печатает»: отметка в чате задачи и в личной переписке
alter table public.chat_reads add column typing_at timestamptz;
create table public.direct_typing (
  user_id uuid not null references public.profiles (id) on delete cascade,
  peer_id uuid not null references public.profiles (id) on delete cascade,
  typing_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

-- ---------- RLS ----------
alter table public.follows enable row level security;
alter table public.contacts enable row level security;
alter table public.blocks enable row level security;
alter table public.task_invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_typing enable row level security;

create policy follows_read on public.follows for select to authenticated
  using (auth.uid() in (follower_id, followee_id));
create policy contacts_read on public.contacts for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy blocks_read on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy invitations_read on public.task_invitations for select to authenticated
  using (auth.uid() in (from_id, to_id));
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid() and visible_at <= now());
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy direct_messages_read on public.direct_messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));
create policy direct_typing_read on public.direct_typing for select to authenticated
  using (peer_id = auth.uid() or user_id = auth.uid());

-- ---------- Вспомогательное ----------
create or replace function private.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

create or replace function private.are_contacts(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contacts
                  where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted')
$$;

/** Работали вместе (заказчик и исполнитель одной задачи) */
create or replace function private.worked_together(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks
                  where (customer_id = p_a and executor_id = p_b) or (customer_id = p_b and executor_id = p_a))
$$;

/** Разрешено ли действие по правилу приватности «все / контакты / только клиенты» */
create or replace function private.allowed_by(p_owner uuid, p_viewer uuid, p_rule text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_owner = p_viewer or case p_rule
    when 'contacts' then private.are_contacts(p_owner, p_viewer)
    when 'clients' then private.worked_together(p_owner, p_viewer)
    when 'me' then false
    else true end
$$;

create or replace function private.notify(p_user uuid, p_kind text, p_actor uuid, p_task uuid, p_payload jsonb default '{}', p_visible_at timestamptz default now())
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  if p_actor is not null and private.is_blocked_between(p_user, p_actor) then
    return;
  end if;
  insert into public.notifications (user_id, kind, actor_id, task_id, payload, visible_at)
  values (p_user, p_kind, p_actor, p_task, coalesce(p_payload, '{}'), p_visible_at);
end $$;

-- ---------- Уведомления из событий задач ----------
create or replace function private.on_message_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.tasks;
  v_event text := new.body;
begin
  select * into v from public.tasks where id = new.task_id;
  if new.kind = 'text' then
    -- Одно непрочитанное уведомление о сообщениях на чат
    if not exists (
      select 1 from public.notifications
       where user_id = case when new.sender_id = v.customer_id then v.executor_id else v.customer_id end
         and kind = 'new_message' and task_id = v.id and read_at is null
    ) then
      perform private.notify(case when new.sender_id = v.customer_id then v.executor_id else v.customer_id end,
                             'new_message', new.sender_id, v.id, jsonb_build_object('title', v.title));
    end if;
    return new;
  end if;
  if v_event in ('executor_assigned', 'revision_requested', 'work_accepted', 'extension_accepted', 'extension_declined', 'tip_sent', 'dispute_opened') then
    perform private.notify(v.executor_id, v_event, v.customer_id, v.id, jsonb_build_object('title', v.title) || coalesce(new.meta, '{}'));
  end if;
  if v_event in ('work_submitted', 'task_taken', 'work_started', 'executor_refused', 'take_expired', 'extension_requested', 'dispute_opened') then
    perform private.notify(v.customer_id, v_event, v.executor_id, v.id, jsonb_build_object('title', v.title) || coalesce(new.meta, '{}'));
  end if;
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function private.on_message_notify();

create or replace function private.on_response_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.tasks;
begin
  select * into v from public.tasks where id = new.task_id;
  if tg_op = 'INSERT' then
    perform private.notify(v.customer_id, 'new_response', new.executor_id, v.id, jsonb_build_object('title', v.title, 'price_cents', new.price_cents));
  elsif new.status = 'rejected' and old.status = 'pending' and v.executor_id is distinct from new.executor_id then
    perform private.notify(new.executor_id, 'response_rejected', v.customer_id, v.id, jsonb_build_object('title', v.title, 'response_id', new.id));
  end if;
  return new;
end $$;
create trigger responses_notify after insert or update of status on public.task_responses
  for each row execute function private.on_response_notify();

/** Новая задача → тем, у кого совпадают навыки (Pro раньше остальных) */
create or replace function private.on_task_publish_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') and cardinality(new.skills) > 0 then
    insert into public.notifications (user_id, kind, actor_id, task_id, payload, visible_at)
    select p.id, 'skill_task', new.customer_id, new.id,
           jsonb_build_object('title', new.title, 'reward_cents', new.reward_cents, 'currency', new.currency),
           now() + case when p.plan = 'pro' then interval '0' else interval '10 minutes' end
      from public.profiles p
     where p.id <> new.customer_id and p.notify_skill_tasks and p.onboarding = 'done'
       and p.banned_at is null and p.deactivated_at is null and p.deleted_at is null
       and exists (select 1 from public.profile_skills s where s.profile_id = p.id and s.skill_slug = any (new.skills))
       and (new.kind <> 'campus' or p.university_id = new.university_id)
       and not private.is_blocked_between(p.id, new.customer_id)
     limit 200;
  end if;
  return new;
end $$;
create trigger tasks_publish_notify after insert or update of status on public.tasks
  for each row execute function private.on_task_publish_notify();

-- ---------- Подписки, контакты, блокировки ----------
create or replace function public.follow_user(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_target public.profiles;
begin
  select * into v_target from public.profiles where id = p_user and deactivated_at is null and deleted_at is null and banned_at is null;
  if v_target.id is null or v_target.id = v_uid then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if not p_on then
    delete from public.follows where follower_id = v_uid and followee_id = p_user;
    return;
  end if;
  if private.is_blocked_between(v_uid, p_user) or not private.allowed_by(p_user, v_uid, private.privacy_value(v_target.privacy, 'who_follow')) then
    raise exception 'privacy_forbidden' using errcode = '42501';
  end if;
  insert into public.follows (follower_id, followee_id) values (v_uid, p_user) on conflict do nothing;
  if found then
    perform private.notify(p_user, 'new_follower', v_uid, null);
  end if;
end $$;

create or replace function public.contact_request(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_row public.contacts;
begin
  if p_user = v_uid or not exists (select 1 from public.profiles where id = p_user and deactivated_at is null and deleted_at is null and banned_at is null) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_uid, p_user) then
    raise exception 'privacy_forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.contacts where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) for update;
  if v_row.user_a is null then
    insert into public.contacts (user_a, user_b, requested_by) values (least(v_uid, p_user), greatest(v_uid, p_user), v_uid);
    perform private.notify(p_user, 'contact_request', v_uid, null);
    return 'pending';
  end if;
  -- Встречный запрос = согласие
  if v_row.status = 'pending' and v_row.requested_by <> v_uid then
    update public.contacts set status = 'accepted', accepted_at = now() where user_a = v_row.user_a and user_b = v_row.user_b;
    perform private.notify(p_user, 'contact_accepted', v_uid, null);
    return 'accepted';
  end if;
  return v_row.status;
end $$;

create or replace function public.contact_respond(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_row public.contacts;
begin
  select * into v_row from public.contacts where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) for update;
  if v_row.user_a is null or v_row.status <> 'pending' or v_row.requested_by = v_uid then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if p_accept then
    update public.contacts set status = 'accepted', accepted_at = now() where user_a = v_row.user_a and user_b = v_row.user_b;
    perform private.notify(p_user, 'contact_accepted', v_uid, null);
  else
    delete from public.contacts where user_a = v_row.user_a and user_b = v_row.user_b;
  end if;
end $$;

/** Отменить свой запрос или удалить контакт */
create or replace function public.contact_remove(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  delete from public.contacts where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
end $$;

/** Блокировка: снимает подписки и контакты в обе стороны; заблокированный не узнаёт */
create or replace function public.block_user(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  if p_user = v_uid then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not p_on then
    delete from public.blocks where blocker_id = v_uid and blocked_id = p_user;
    return;
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  delete from public.follows where (follower_id = v_uid and followee_id = p_user) or (follower_id = p_user and followee_id = v_uid);
  delete from public.contacts where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
  update public.task_invitations set status = 'cancelled', decided_at = now()
   where status = 'pending' and ((from_id = v_uid and to_id = p_user) or (from_id = p_user and to_id = v_uid));
end $$;

create or replace function public.my_blocked() returns table (id uuid, name text, avatar_url text, username text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.avatar_url, p.username::text, b.created_at
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc
$$;

/** Связи: подписчики, подписки, контакты, входящие и исходящие запросы */
create or replace function public.my_connections(p_kind text) returns table (
  id uuid, name text, username text, avatar_url text, headline text, city text,
  rating_avg numeric, completed_count int, since timestamptz, incoming boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  ids as (
    select f.follower_id as id, f.created_at as since, true as incoming from public.follows f, me where p_kind = 'followers' and f.followee_id = me.uid
    union all
    select f.followee_id, f.created_at, false from public.follows f, me where p_kind = 'following' and f.follower_id = me.uid
    union all
    select case when c.user_a = me.uid then c.user_b else c.user_a end, coalesce(c.accepted_at, c.created_at), c.requested_by <> me.uid
      from public.contacts c, me
     where me.uid in (c.user_a, c.user_b)
       and ((p_kind = 'contacts' and c.status = 'accepted') or (p_kind = 'requests' and c.status = 'pending'))
  )
  select p.id, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.username::text, p.avatar_url,
         coalesce(p.headline, p.profession), p.city, p.rating_avg, p.completed_count, ids.since, ids.incoming
    from ids join public.profiles p on p.id = ids.id
   where p.deactivated_at is null and p.deleted_at is null and p.banned_at is null
   order by ids.since desc
$$;

-- ---------- Приглашения в задачу ----------
create or replace function public.invite_to_task(p_task uuid, p_user uuid, p_message text, p_days int) returns public.task_invitations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_target public.profiles;
  v_inv public.task_invitations;
begin
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'open' or v.expires_at <= now() then
    raise exception 'task_not_open' using errcode = '55000';
  end if;
  if p_days not in (1, 3, 7) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into v_target from public.profiles where id = p_user and deactivated_at is null and deleted_at is null and banned_at is null;
  if v_target.id is null or v_target.id = v_uid then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_uid, p_user) or not private.allowed_by(p_user, v_uid, private.privacy_value(v_target.privacy, 'who_invite')) then
    raise exception 'privacy_forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.task_invitations where task_id = v.id and to_id = p_user and status = 'pending') then
    raise exception 'already_invited' using errcode = '23505';
  end if;
  insert into public.task_invitations (task_id, from_id, to_id, message, respond_by)
  values (v.id, v_uid, p_user, nullif(btrim(p_message), ''), now() + make_interval(days => p_days))
  returning * into v_inv;
  perform private.notify(p_user, 'task_invitation', v_uid, v.id, jsonb_build_object('title', v.title, 'invitation_id', v_inv.id));
  return v_inv;
end $$;

/** Согласие на приглашение закрепляет задачу за исполнителем (как выбор отклика по цене задачи) */
create or replace function public.respond_invitation(p_invitation uuid, p_accept boolean) returns public.task_invitations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_inv public.task_invitations;
  v public.tasks;
  v_plan public.plan_id;
begin
  select * into v_inv from public.task_invitations where id = p_invitation for update;
  if v_inv.id is null or v_inv.to_id <> v_uid then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' or v_inv.respond_by <= now() then
    raise exception 'invitation_expired' using errcode = '55000';
  end if;
  if not p_accept then
    update public.task_invitations set status = 'declined', decided_at = now() where id = v_inv.id returning * into v_inv;
    perform private.notify(v_inv.from_id, 'invitation_declined', v_uid, v_inv.task_id);
    return v_inv;
  end if;
  v := private.lock_task(v_inv.task_id);
  if v.status <> 'open' or v.expires_at <= now() then
    raise exception 'task_not_open' using errcode = '55000';
  end if;
  select plan into v_plan from public.profiles where id = v_uid;
  update public.task_responses set status = 'rejected' where task_id = v.id and status = 'pending';
  update public.tasks
     set status = 'in_progress', executor_id = v_uid, take_mode = 'response', assigned_at = now(), started_at = now(),
         due_at = now() + make_interval(mins => private.deadline_minutes(v.deadline) + private.deadline_bonus_minutes(v_plan))
   where id = v.id;
  update public.task_invitations set status = 'accepted', decided_at = now() where id = v_inv.id returning * into v_inv;
  update public.task_invitations set status = 'cancelled', decided_at = now() where task_id = v.id and status = 'pending';
  perform private.system_message(v.id, 'executor_assigned', jsonb_build_object('executor_id', v_uid, 'via', 'invitation'));
  return v_inv;
end $$;

create or replace function public.my_invitations() returns table (
  id uuid, task_id uuid, title text, reward_cents bigint, currency public.money_currency, task_status public.task_status,
  from_id uuid, from_name text, from_avatar text, to_id uuid, to_name text, message text, respond_by timestamptz,
  status text, created_at timestamptz, incoming boolean
)
language sql stable security definer set search_path = '' as $$
  select i.id, t.id, t.title, t.reward_cents, t.currency, t.status,
         f.id, btrim(coalesce(f.first_name, '') || ' ' || coalesce(f.last_name, '')), f.avatar_url,
         r.id, btrim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')),
         i.message, i.respond_by,
         case when i.status = 'pending' and i.respond_by <= now() then 'expired' else i.status end,
         i.created_at, i.to_id = auth.uid()
    from public.task_invitations i
    join public.tasks t on t.id = i.task_id
    join public.profiles f on f.id = i.from_id
    join public.profiles r on r.id = i.to_id
   where auth.uid() in (i.from_id, i.to_id)
   order by i.created_at desc
$$;

-- ---------- Уведомления: чтение ----------
create or replace function public.my_notifications(p_limit int default 50) returns table (
  id bigint, kind text, actor_id uuid, actor_name text, actor_avatar text, task_id uuid, payload jsonb, read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor_id, btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), a.avatar_url,
         n.task_id, n.payload, n.read_at, n.visible_at
    from public.notifications n left join public.profiles a on a.id = n.actor_id
   where n.user_id = auth.uid() and n.visible_at <= now()
   order by n.visible_at desc, n.id desc
   limit least(greatest(p_limit, 1), 200)
$$;

create or replace function public.unread_notifications() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null and visible_at <= now()
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and visible_at <= now() and (p_ids is null or id = any (p_ids))
$$;

create or replace function public.clear_notifications() returns void
language sql security definer set search_path = '' as $$
  delete from public.notifications where user_id = auth.uid() and visible_at <= now()
$$;

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  insert into public.push_tokens (token, user_id, platform) values (p_token, v_uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform;
end $$;

-- ---------- Личные сообщения ----------
create or replace function public.send_direct(p_to uuid, p_body text) returns public.direct_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_target public.profiles;
  v_msg public.direct_messages;
begin
  select * into v_target from public.profiles where id = p_to and deactivated_at is null and deleted_at is null and banned_at is null;
  if v_target.id is null or v_target.id = v_uid then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  -- Блокировка скрыта: для отправителя это выглядит как запрет приватности
  if private.is_blocked_between(v_uid, p_to)
     or (not private.allowed_by(p_to, v_uid, private.privacy_value(v_target.privacy, 'who_message'))
         and not exists (select 1 from public.direct_messages where sender_id = p_to and recipient_id = v_uid)) then
    raise exception 'privacy_forbidden' using errcode = '42501';
  end if;
  insert into public.direct_messages (sender_id, recipient_id, body) values (v_uid, p_to, btrim(p_body)) returning * into v_msg;
  delete from public.direct_typing where user_id = v_uid and peer_id = p_to;
  if not exists (select 1 from public.notifications where user_id = p_to and kind = 'direct_message' and actor_id = v_uid and read_at is null) then
    perform private.notify(p_to, 'direct_message', v_uid, null, jsonb_build_object('body', left(v_msg.body, 120)));
  end if;
  return v_msg;
end $$;

create or replace function public.direct_with(p_user uuid) returns setof public.direct_messages
language sql stable security definer set search_path = '' as $$
  select * from public.direct_messages
   where (sender_id = auth.uid() and recipient_id = p_user) or (sender_id = p_user and recipient_id = auth.uid())
   order by created_at
$$;

create or replace function public.mark_direct_read(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  update public.direct_messages set read_at = now() where recipient_id = auth.uid() and sender_id = p_user and read_at is null;
  update public.notifications set read_at = now() where user_id = auth.uid() and kind = 'direct_message' and actor_id = p_user and read_at is null;
$$;

create or replace function public.my_direct_threads() returns table (
  peer_id uuid, peer_name text, peer_avatar text, peer_username text, last_body text, last_sender uuid, last_at timestamptz, unread int, peer_read_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as peer, d.*
      from public.direct_messages d where auth.uid() in (sender_id, recipient_id)
  ), last as (
    select distinct on (peer) peer, body, sender_id, created_at from mine order by peer, created_at desc
  )
  select p.id, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.avatar_url, p.username::text,
         l.body, l.sender_id, l.created_at,
         (select count(*)::int from mine m where m.peer = l.peer and m.recipient_id = auth.uid() and m.read_at is null),
         (select max(m.read_at) from mine m where m.peer = l.peer and m.sender_id = auth.uid())
    from last l join public.profiles p on p.id = l.peer
   order by l.created_at desc
$$;

-- ---------- «Печатает» ----------
create or replace function public.set_typing(p_task uuid default null, p_peer uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  update public.profiles set last_seen_at = now() where id = v_uid;
  if p_task is not null then
    if not exists (select 1 from public.tasks where id = p_task and v_uid in (customer_id, executor_id)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    insert into public.chat_reads (task_id, user_id, last_read_at, typing_at) values (p_task, v_uid, now(), now())
    on conflict (task_id, user_id) do update set typing_at = now();
  elsif p_peer is not null then
    insert into public.direct_typing (user_id, peer_id, typing_at) values (v_uid, p_peer, now())
    on conflict (user_id, peer_id) do update set typing_at = now();
  end if;
end $$;

/** Состояние собеседника: прочитал до, печатает ли сейчас (последние 6 секунд), когда был в сети */
create or replace function public.peer_state(p_task uuid default null, p_peer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.tasks;
  v_peer uuid := p_peer;
  v_read timestamptz;
  v_typing timestamptz;
  v_profile public.profiles;
begin
  if p_task is not null then
    select * into v from public.tasks where id = p_task and auth.uid() in (customer_id, executor_id);
    if v.id is null then
      return null;
    end if;
    v_peer := case when v.customer_id = auth.uid() then v.executor_id else v.customer_id end;
    select last_read_at, typing_at into v_read, v_typing from public.chat_reads where task_id = p_task and user_id = v_peer;
  else
    select max(read_at) into v_read from public.direct_messages where sender_id = auth.uid() and recipient_id = v_peer;
    select typing_at into v_typing from public.direct_typing where user_id = v_peer and peer_id = auth.uid();
  end if;
  select * into v_profile from public.profiles where id = v_peer;
  return jsonb_build_object(
    'read_at', v_read,
    'typing', coalesce(v_typing > now() - interval '6 seconds', false),
    'last_seen_at', case when private.privacy_value(v_profile.privacy, 'online') = 'all' then v_profile.last_seen_at end
  );
end $$;

-- ---------- Приватность и аккаунт ----------
create or replace function public.save_privacy(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_key text;
  v_out jsonb := '{}';
begin
  for v_key in select jsonb_object_keys(p) loop
    if v_key in ('profile', 'city', 'online', 'activity', 'reviews', 'portfolio', 'history') then
      if p ->> v_key not in ('all', 'me') then raise exception 'invalid_input' using errcode = '22023'; end if;
    elsif v_key in ('who_message', 'who_invite', 'who_follow') then
      if p ->> v_key not in ('all', 'contacts', 'clients') then raise exception 'invalid_input' using errcode = '22023'; end if;
    elsif v_key in ('search_engines', 'university', 'recommendations') then
      if jsonb_typeof(p -> v_key) <> 'boolean' then raise exception 'invalid_input' using errcode = '22023'; end if;
    else
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    v_out := v_out || jsonb_build_object(v_key, p -> v_key);
  end loop;
  update public.profiles set privacy = v_out where id = v_uid;
  return v_out;
end $$;

/** Что мешает уйти: активные задачи, деньги на балансе, открытые выводы и споры */
create or replace function public.account_exit_blockers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active_tasks', (select count(*) from public.tasks
                      where auth.uid() in (customer_id, executor_id) and status in ('in_progress', 'review', 'disputed')),
    'open_tasks', (select count(*) from public.tasks where customer_id = auth.uid() and status = 'open'),
    'balance_cents', coalesce((select sum(amount_cents) from public.ledger_entries
                                where user_id = auth.uid() and account in ('available', 'hold', 'escrow')), 0),
    'pending_payouts', (select count(*) from public.payouts where user_id = auth.uid() and status in ('requested', 'on_hold', 'approved', 'processing'))
  )
$$;

create or replace function public.deactivate_account(p_reason text, p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v jsonb := public.account_exit_blockers();
  v_task public.tasks;
begin
  if p_confirm <> 'ДЕАКТИВАЦИЯ' then
    raise exception 'confirm_word' using errcode = '22023';
  end if;
  if (v ->> 'active_tasks')::int > 0 then
    raise exception 'has_active_tasks' using errcode = '55000';
  end if;
  for v_task in select * from public.tasks where customer_id = v_uid and status = 'open' for update loop
    perform private.archive_task(v_task, 'cancelled');
  end loop;
  update public.profiles set deactivated_at = now() where id = v_uid;
  update public.profile_private set deactivation_reason = left(p_reason, 300) where id = v_uid;
end $$;

create or replace function public.restore_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.profiles set deactivated_at = null
   where id = auth.uid() and deactivated_at is not null and deleted_at is null and banned_at is null;
end $$;

/** Удаление навсегда: профиль обезличивается; финансовые записи сохраняются по закону */
create or replace function public.delete_account(p_reason text, p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v jsonb := public.account_exit_blockers();
  v_task public.tasks;
begin
  if p_confirm <> 'УДАЛЕНИЕ' then
    raise exception 'confirm_word' using errcode = '22023';
  end if;
  if (v ->> 'active_tasks')::int > 0 then
    raise exception 'has_active_tasks' using errcode = '55000';
  end if;
  for v_task in select * from public.tasks where customer_id = v_uid and status = 'open' for update loop
    perform private.archive_task(v_task, 'cancelled');
  end loop;
  v := public.account_exit_blockers();
  if (v ->> 'balance_cents')::bigint > 0 or (v ->> 'pending_payouts')::int > 0 then
    raise exception 'has_balance' using errcode = '55000';
  end if;
  delete from public.follows where v_uid in (follower_id, followee_id);
  delete from public.contacts where v_uid in (user_a, user_b);
  delete from public.portfolio_items where profile_id = v_uid;
  delete from public.profile_skills where profile_id = v_uid;
  delete from public.push_tokens where user_id = v_uid;
  update public.profiles
     set first_name = null, last_name = null, display_name = null, username = null, avatar_url = null, bio = null,
         headline = null, profession = null, city = null, links = '[]', portfolio_links = '{}', custom_skills = '{}',
         languages = '[]', deleted_at = now()
   where id = v_uid;
  update public.profile_private set phone = null, birth_date = null, student_email = null, deactivation_reason = left(p_reason, 300)
   where id = v_uid;
end $$;

-- ---------- Поиск людей ----------
create or replace function public.search_people(
  p_query text default null,
  p_role text default 'all',
  p_skill text default null,
  p_city text default null,
  p_min_rating numeric default null,
  p_available boolean default false,
  p_sort text default 'relevance',
  p_limit int default 30,
  p_offset int default 0
) returns table (
  id uuid, name text, username text, avatar_url text, headline text, city text, country_code text,
  rating_avg numeric, rating_count int, completed_count int, availability public.availability,
  platform_role public.platform_role, skills text[], verified boolean, plan public.plan_id
)
language sql stable security definer set search_path = '' as $$
  select p.id, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.username::text, p.avatar_url,
         coalesce(p.headline, p.profession),
         case when private.privacy_value(p.privacy, 'city') = 'all' then p.city end,
         p.country_code::text, p.rating_avg, p.rating_count, p.completed_count, p.availability, p.platform_role,
         array(select s.skill_slug from public.profile_skills s where s.profile_id = p.id order by s.sort limit 6),
         p.verified_at is not null, p.plan
    from public.profiles p
   where p.onboarding = 'done' and p.banned_at is null and p.deactivated_at is null and p.deleted_at is null
     and p.id is distinct from auth.uid()
     and private.privacy_value(p.privacy, 'profile') = 'all'
     and p.availability <> 'hidden'
     and (auth.uid() is null or not private.is_blocked_between(p.id, auth.uid()))
     and (p_role = 'all' or (p_role = 'executors' and p.platform_role in ('executor', 'both'))
                         or (p_role = 'customers' and p.platform_role in ('customer', 'both')))
     and (p_skill is null or exists (select 1 from public.profile_skills s where s.profile_id = p.id and s.skill_slug = p_skill))
     and (p_city is null or p.city ilike '%' || p_city || '%')
     and (p_min_rating is null or p.rating_avg >= p_min_rating)
     and (not p_available or p.availability = 'available')
     and (p_query is null or btrim(p_query) = '' or
          (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' || coalesce(p.username::text, '') || ' ' ||
           coalesce(p.headline, '') || ' ' || coalesce(p.profession, '') || ' ' || coalesce(p.bio, '')) ilike '%' || btrim(p_query) || '%'
          or exists (select 1 from public.profile_skills s where s.profile_id = p.id and s.skill_slug ilike '%' || btrim(p_query) || '%'))
   order by
     case when p_sort = 'rating' then coalesce(p.rating_avg, 0) end desc nulls last,
     case when p_sort = 'experience' then p.completed_count end desc nulls last,
     (p.plan = 'pro') desc, p.completed_count desc, coalesce(p.rating_avg, 0) desc, p.created_at
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- ---------- Публичный профиль ----------
create or replace function public.public_profile(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles;
  v_self boolean;
  v_contact public.contacts;
  v_out jsonb;
  v_hidden text[];
begin
  select * into p from public.profiles
   where (id::text = p_handle or username = p_handle::extensions.citext)
     and onboarding = 'done' and banned_at is null and deleted_at is null
   limit 1;
  if p.id is null then
    return null;
  end if;
  v_self := p.id = v_uid;
  if not v_self and (p.deactivated_at is not null or (v_uid is not null and private.is_blocked_between(p.id, v_uid))) then
    return null;
  end if;
  if not v_self and private.privacy_value(p.privacy, 'profile') = 'me' then
    return jsonb_build_object('id', p.id, 'name', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
                              'avatar_url', p.avatar_url, 'private', true);
  end if;
  v_hidden := case when v_self then '{}'::text[] else p.hidden_fields end;
  if v_uid is not null then
    select * into v_contact from public.contacts where user_a = least(p.id, v_uid) and user_b = greatest(p.id, v_uid);
  end if;

  v_out := jsonb_build_object(
    'id', p.id,
    'name', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'headline', p.headline,
    'profession', p.profession,
    'bio', case when 'bio' = any (v_hidden) then null else p.bio end,
    'country_code', p.country_code,
    'city', case when not v_self and (private.privacy_value(p.privacy, 'city') = 'me' or 'city' = any (v_hidden)) then null else p.city end,
    'languages', case when 'languages' = any (v_hidden) then '[]'::jsonb else p.languages end,
    'links', case when 'links' = any (v_hidden) then '[]'::jsonb else p.links end,
    'platform_role', p.platform_role,
    'availability', p.availability,
    'response_time', p.response_time,
    'experience_level', p.experience_level,
    'plan', p.plan,
    'verified', p.verified_at is not null,
    'created_at', p.created_at,
    'last_seen_at', case when v_self or private.privacy_value(p.privacy, 'online') = 'all' then p.last_seen_at end,
    'university', (select jsonb_build_object('id', u.id, 'name', u.name) from public.universities u where u.id = p.university_id),
    'stats', jsonb_build_object(
      'rating_avg', p.rating_avg, 'rating_count', p.rating_count, 'completed', p.completed_count,
      'earned_cents', case when v_self then p.earned_cents end,
      'customer_completed', (select count(*) from public.tasks where customer_id = p.id and status = 'completed'),
      'followers', (select count(*) from public.follows where followee_id = p.id),
      'following', (select count(*) from public.follows where follower_id = p.id),
      'contacts', (select count(*) from public.contacts where p.id in (user_a, user_b) and status = 'accepted')
    ),
    'aspects', case when v_self or private.privacy_value(p.privacy, 'reviews') = 'all' then (
      select jsonb_build_object('quality', round(avg(quality), 1), 'communication', round(avg(communication), 1),
                                'deadlines', round(avg(deadlines), 1), 'requirements', round(avg(requirements), 1))
        from public.reviews where target_id = p.id) end,
    'skills', coalesce((select jsonb_agg(jsonb_build_object('slug', s.skill_slug, 'level', s.level) order by s.sort)
                          from public.profile_skills s where s.profile_id = p.id), '[]'),
    'custom_skills', to_jsonb(p.custom_skills),
    'experience', case when 'experience' = any (v_hidden) then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(e) - 'profile_id' order by e.sort) from public.profile_experience e where e.profile_id = p.id), '[]') end,
    'portfolio', case when not v_self and private.privacy_value(p.privacy, 'portfolio') = 'me' then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(i) - 'profile_id' order by i.created_at desc)
        from public.portfolio_items i
       where i.profile_id = p.id
         and (v_self or i.visibility = 'public' or (i.visibility = 'clients' and private.worked_together(p.id, v_uid)))), '[]') end,
    'open_tasks', case when not v_self and private.privacy_value(p.privacy, 'history') = 'me' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'reward_cents', t.reward_cents, 'currency', t.currency,
                                          'category', t.category, 'kind', t.kind, 'deadline', t.deadline) order by t.published_at desc)
        from (select * from public.tasks t where t.customer_id = p.id and t.status = 'open' and t.expires_at > now()
                and (t.kind <> 'campus' or t.university_id = private.my_university_id())
              order by t.published_at desc limit 6) t), '[]') end,
    'relation', jsonb_build_object(
      'self', v_self,
      'following', v_uid is not null and exists (select 1 from public.follows where follower_id = v_uid and followee_id = p.id),
      'followed_by', v_uid is not null and exists (select 1 from public.follows where follower_id = p.id and followee_id = v_uid),
      'contact', case when v_contact.user_a is null then 'none'
                      when v_contact.status = 'accepted' then 'accepted'
                      when v_contact.requested_by = v_uid then 'outgoing' else 'incoming' end,
      'blocked', v_uid is not null and exists (select 1 from public.blocks where blocker_id = v_uid and blocked_id = p.id),
      'can_message', v_self or (v_uid is not null and private.allowed_by(p.id, v_uid, private.privacy_value(p.privacy, 'who_message'))),
      'can_invite', v_uid is not null and not v_self and private.allowed_by(p.id, v_uid, private.privacy_value(p.privacy, 'who_invite')),
      'can_follow', v_uid is not null and not v_self and private.allowed_by(p.id, v_uid, private.privacy_value(p.privacy, 'who_follow'))
    )
  );
  if v_self then
    v_out := v_out || jsonb_build_object('privacy', p.privacy, 'hidden_fields', to_jsonb(p.hidden_fields));
  end if;
  return v_out;
end $$;

/** Отзывы о человеке (если он их не скрыл) */
create or replace function public.reviews_of(p_user uuid) returns table (
  id uuid, rating int, quality int, communication int, deadlines int, requirements int, public_text text,
  author_role text, created_at timestamptz, author_id uuid, author_name text, author_avatar text, task_id uuid, task_title text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.quality, r.communication, r.deadlines, r.requirements, r.public_text, r.author_role::text, r.created_at,
         a.id, btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), a.avatar_url, t.id, t.title
    from public.reviews r
    join public.profiles p on p.id = r.target_id
    left join public.profiles a on a.id = r.author_id
    left join public.tasks t on t.id = r.task_id
   where r.target_id = p_user and (p.id = auth.uid() or private.privacy_value(p.privacy, 'reviews') = 'all')
   order by r.created_at desc
$$;

-- ---------- Права ----------
revoke all on function private.privacy_value(jsonb, text), private.is_blocked_between(uuid, uuid), private.are_contacts(uuid, uuid),
  private.worked_together(uuid, uuid), private.allowed_by(uuid, uuid, text),
  private.notify(uuid, text, uuid, uuid, jsonb, timestamptz) from public;
grant execute on function private.privacy_value(jsonb, text), private.is_blocked_between(uuid, uuid), private.are_contacts(uuid, uuid),
  private.worked_together(uuid, uuid), private.allowed_by(uuid, uuid, text) to anon, authenticated, service_role;

revoke all on function
  public.follow_user(uuid, boolean), public.contact_request(uuid), public.contact_respond(uuid, boolean), public.contact_remove(uuid),
  public.block_user(uuid, boolean), public.my_blocked(), public.my_connections(text),
  public.invite_to_task(uuid, uuid, text, int), public.respond_invitation(uuid, boolean), public.my_invitations(),
  public.my_notifications(int), public.unread_notifications(), public.mark_notifications_read(bigint[]), public.clear_notifications(),
  public.register_push_token(text, text),
  public.send_direct(uuid, text), public.direct_with(uuid), public.mark_direct_read(uuid), public.my_direct_threads(),
  public.set_typing(uuid, uuid), public.peer_state(uuid, uuid),
  public.save_privacy(jsonb), public.account_exit_blockers(), public.deactivate_account(text, text), public.restore_account(),
  public.delete_account(text, text), public.reviews_of(uuid)
from public, anon;
grant execute on function
  public.follow_user(uuid, boolean), public.contact_request(uuid), public.contact_respond(uuid, boolean), public.contact_remove(uuid),
  public.block_user(uuid, boolean), public.my_blocked(), public.my_connections(text),
  public.invite_to_task(uuid, uuid, text, int), public.respond_invitation(uuid, boolean), public.my_invitations(),
  public.my_notifications(int), public.unread_notifications(), public.mark_notifications_read(bigint[]), public.clear_notifications(),
  public.register_push_token(text, text),
  public.send_direct(uuid, text), public.direct_with(uuid), public.mark_direct_read(uuid), public.my_direct_threads(),
  public.set_typing(uuid, uuid), public.peer_state(uuid, uuid),
  public.save_privacy(jsonb), public.account_exit_blockers(), public.deactivate_account(text, text), public.restore_account(),
  public.delete_account(text, text), public.reviews_of(uuid)
to authenticated;
grant execute on function public.search_people(text, text, text, text, numeric, boolean, text, int, int), public.public_profile(text)
  to anon, authenticated;
grant select on public.follows, public.contacts, public.blocks, public.task_invitations, public.notifications,
  public.direct_messages, public.direct_typing to authenticated;
grant select, insert, delete on public.push_tokens to authenticated;
