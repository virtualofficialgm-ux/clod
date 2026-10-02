-- Этап «сервис»: поддержка, споры с решением модератора, верификация, бот PARRI,
-- модерация задач и пользователей, сверка пополнений, журнал аудита.

-- ---------- Журнал аудита ----------
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
create policy admin_audit_staff on public.admin_audit for select to authenticated using (private.is_staff());

create or replace function private.require_staff() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function private.audit(p_action text, p_target text, p_payload jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit (actor_id, action, target, payload) values (auth.uid(), p_action, p_target, coalesce(p_payload, '{}'));
$$;

-- ---------- Поддержка ----------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('tasks', 'payments', 'account', 'verification', 'plans', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'closed')),
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user on public.support_tickets (user_id, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  from_staff boolean not null default false,
  internal boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  created_at timestamptz not null default clock_timestamp()
);
create index support_messages_ticket on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy tickets_read on public.support_tickets for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy ticket_messages_read on public.support_messages for select to authenticated using (
  private.is_staff() or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
);

/** Обращение может создать и заблокированный модератором (чтобы оспорить) */
create or replace function private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

create or replace function public.create_ticket(p_category text, p_subject text, p_body text, p_files jsonb default '[]', p_task uuid default null)
returns public.support_tickets
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v public.support_tickets;
begin
  if char_length(btrim(coalesce(p_body, ''))) < 10 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  insert into public.support_tickets (user_id, category, subject, task_id) values (v_uid, p_category, btrim(p_subject), p_task) returning * into v;
  insert into public.support_messages (ticket_id, author_id, body, files) values (v.id, v_uid, btrim(p_body), private.validate_files(coalesce(p_files, '[]'), v_uid::text || '/'));
  return v;
end $$;

create or replace function public.ticket_reply(p_ticket uuid, p_body text, p_files jsonb default '[]', p_internal boolean default false)
returns public.support_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v public.support_tickets;
  v_staff boolean := private.is_staff();
  v_msg public.support_messages;
begin
  select * into v from public.support_tickets where id = p_ticket for update;
  if v.id is null or (v.user_id <> v_uid and not v_staff) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status = 'closed' and not v_staff then
    raise exception 'ticket_closed' using errcode = '55000';
  end if;
  insert into public.support_messages (ticket_id, author_id, from_staff, internal, body, files)
  values (v.id, v_uid, v_staff and v.user_id <> v_uid, v_staff and p_internal, btrim(p_body), private.validate_files(coalesce(p_files, '[]'), v_uid::text || '/'))
  returning * into v_msg;
  update public.support_tickets
     set updated_at = now(),
         status = case when v_staff and v.user_id <> v_uid and not p_internal then 'waiting'
                       when not v_staff then 'open' else status end
   where id = v.id;
  if v_staff and v.user_id <> v_uid and not p_internal then
    perform private.notify(v.user_id, 'support_reply', v_uid, null, jsonb_build_object('ticket_id', v.id, 'subject', v.subject));
  end if;
  return v_msg;
end $$;

create or replace function public.ticket_set_status(p_ticket uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v public.support_tickets;
begin
  select * into v from public.support_tickets where id = p_ticket for update;
  if v.id is null or (v.user_id <> v_uid and not private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Пользователь может только закрыть своё обращение
  if not private.is_staff() and p_status not in ('resolved', 'closed') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = v.id;
  if private.is_staff() then
    perform private.audit('ticket_status', v.id::text, jsonb_build_object('status', p_status));
  end if;
end $$;

-- ---------- Споры ----------
alter table public.disputes
  add column kind text not null default 'task' check (kind in ('task', 'account')),
  add column reason_code text check (reason_code in ('mismatch', 'deadline', 'payment', 'refund', 'other')),
  add column desired text check (desired in ('refund', 'partial', 'revision', 'review')),
  add column amount_cents bigint check (amount_cents >= 0),
  add column links text[] not null default '{}' check (cardinality(links) <= 5),
  add column decision text check (decision in ('customer', 'executor', 'compromise', 'rejected')),
  add column executor_cents bigint,
  add column deadline_at timestamptz not null default (now() + interval '48 hours');

create table public.dispute_events (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  kind text not null,
  note text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.dispute_events enable row level security;
create policy dispute_events_read on public.dispute_events for select to authenticated using (
  exists (select 1 from public.disputes d left join public.tasks t on t.id = d.task_id
           where d.id = dispute_id and (private.is_staff() or d.opened_by = auth.uid() or auth.uid() in (t.customer_id, t.executor_id)))
);

create or replace function private.on_dispute_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.dispute_events (dispute_id, kind, actor_id) values (new.id, 'opened', new.opened_by);
  return new;
end $$;
create trigger disputes_created after insert on public.disputes for each row execute function private.on_dispute_created();

/** Открыть спор (Pro): по задаче — участник задачи в работе или на проверке; по аккаунту — оспорить ограничение */
create or replace function public.open_dispute(
  p_kind text, p_task uuid, p_reason_code text, p_details text, p_links text[], p_desired text, p_amount_cents bigint, p_truthful boolean
) returns public.disputes
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_plan public.plan_id;
  v public.tasks;
  v_d public.disputes;
begin
  select plan into v_plan from public.profiles where id = v_uid;
  if v_plan <> 'pro' then
    raise exception 'dispute_requires_pro' using errcode = '42501';
  end if;
  if not coalesce(p_truthful, false) then
    raise exception 'confirm_required' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_details, ''))) < 20 then
    raise exception 'details_short' using errcode = '22023';
  end if;
  if p_kind = 'account' then
    insert into public.disputes (kind, account_id, opened_by, reason, reason_code, desired, links)
    values ('account', v_uid, v_uid, btrim(p_details), p_reason_code, p_desired, coalesce(p_links, '{}'))
    returning * into v_d;
    return v_d;
  end if;
  v := private.lock_task(p_task);
  if v_uid not in (v.customer_id, coalesce(v.executor_id, v.customer_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status not in ('in_progress', 'review') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_amount_cents is not null and (p_amount_cents < 0 or p_amount_cents > v.reward_cents) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update public.tasks set status = 'disputed' where id = v.id;
  insert into public.disputes (kind, task_id, opened_by, reason, reason_code, desired, amount_cents, links)
  values ('task', v.id, v_uid, btrim(p_details), p_reason_code, p_desired, p_amount_cents, coalesce(p_links, '{}'))
  returning * into v_d;
  perform private.system_message(v.id, 'dispute_opened', '{}'::jsonb);
  return v_d;
end $$;

create or replace function public.my_disputes() returns table (
  id uuid, kind text, task_id uuid, task_title text, reason text, reason_code text, desired text, amount_cents bigint,
  status public.dispute_status, decision text, executor_cents bigint, resolution text, deadline_at timestamptz,
  created_at timestamptz, resolved_at timestamptz, opened_by_me boolean, events jsonb
)
language sql stable security definer set search_path = '' as $$
  select d.id, d.kind, d.task_id, t.title, d.reason, d.reason_code, d.desired, d.amount_cents, d.status, d.decision, d.executor_cents,
         d.resolution, d.deadline_at, d.created_at, d.resolved_at, d.opened_by = auth.uid(),
         coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'note', e.note, 'at', e.created_at) order by e.created_at)
                     from public.dispute_events e where e.dispute_id = d.id), '[]')
    from public.disputes d left join public.tasks t on t.id = d.task_id
   where d.opened_by = auth.uid() or auth.uid() in (t.customer_id, t.executor_id) or d.account_id = auth.uid()
   order by d.created_at desc
$$;

/** Решение модератора: деньги из Сейфа исполнителю, заказчику или поровну по сумме */
create or replace function public.admin_dispute_decide(p_dispute uuid, p_decision text, p_executor_cents bigint default null, p_note text default null)
returns public.disputes
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v_d public.disputes;
  v public.tasks;
  v_escrow bigint;
  v_tx uuid := gen_random_uuid();
  v_exec bigint;
  v_fee bigint;
begin
  select * into v_d from public.disputes where id = p_dispute for update;
  if v_d.id is null then
    raise exception 'dispute_not_found' using errcode = 'P0002';
  end if;
  if v_d.status in ('resolved', 'rejected') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_decision = 'in_progress' then
    update public.disputes set status = 'in_progress' where id = v_d.id returning * into v_d;
    insert into public.dispute_events (dispute_id, kind, note, actor_id) values (v_d.id, 'in_progress', p_note, v_staff);
    perform private.audit('dispute_in_progress', v_d.id::text, '{}');
    return v_d;
  end if;
  if p_decision = 'rejected' then
    update public.disputes set status = 'rejected', decision = 'rejected', resolution = p_note, resolved_by = v_staff, resolved_at = now()
     where id = v_d.id returning * into v_d;
    if v_d.task_id is not null then
      -- Спор отклонён: задача возвращается на проверку
      update public.tasks set status = 'review' where id = v_d.task_id and status = 'disputed';
      update public.submissions set status = 'pending' where task_id = v_d.task_id and status = 'disputed';
    end if;
    insert into public.dispute_events (dispute_id, kind, note, actor_id) values (v_d.id, 'rejected', p_note, v_staff);
    perform private.audit('dispute_rejected', v_d.id::text, '{}');
    return v_d;
  end if;
  if v_d.kind <> 'task' or p_decision not in ('customer', 'executor', 'compromise') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v := private.lock_task(v_d.task_id);
  if v.status <> 'disputed' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  select balance_cents into v_escrow from public.escrow_accounts where task_id = v.id for update;
  v_exec := case p_decision when 'executor' then v.reward_cents when 'customer' then 0 else coalesce(p_executor_cents, -1) end;
  if v_exec < 0 or v_exec > v.reward_cents or (p_decision = 'compromise' and (v_exec = 0 or v_exec = v.reward_cents)) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- Комиссия платформы — пропорционально выплате исполнителю
  v_fee := case when v.reward_cents = 0 then 0 else round(v.fee_cents::numeric * v_exec / v.reward_cents)::bigint end;
  perform private.post(v_tx, 'task_release', 'escrow', v.customer_id, v.id, -v_escrow, 'dispute', v.currency);
  if v_exec > 0 then
    perform private.post(v_tx, 'task_release', 'available', v.executor_id, v.id, v_exec, 'dispute', v.currency);
  end if;
  if v_fee > 0 then
    perform private.post(v_tx, 'task_release', 'platform_revenue', null, v.id, v_fee, 'fee', v.currency);
  end if;
  if v_escrow - v_exec - v_fee > 0 then
    perform private.post(v_tx, 'task_refund', 'available', v.customer_id, v.id, v_escrow - v_exec - v_fee, 'dispute', v.currency);
  end if;
  if v_exec > 0 then
    update public.tasks set status = 'completed', completed_at = now() where id = v.id;
    update public.profiles set completed_count = completed_count + 1,
           earned_cents = earned_cents + case when v.currency = 'USD' then v_exec else 0 end
     where id = v.executor_id;
  else
    update public.tasks set status = 'archived', archive_reason = 'cancelled' where id = v.id;
  end if;
  update public.disputes
     set status = 'resolved', decision = p_decision, executor_cents = v_exec, resolution = p_note, resolved_by = v_staff, resolved_at = now()
   where id = v_d.id returning * into v_d;
  insert into public.dispute_events (dispute_id, kind, note, actor_id) values (v_d.id, 'resolved_' || p_decision, p_note, v_staff);
  perform private.system_message(v.id, 'dispute_resolved', jsonb_build_object('decision', p_decision, 'executor_cents', v_exec));
  perform private.audit('dispute_decide', v_d.id::text, jsonb_build_object('decision', p_decision, 'executor_cents', v_exec));
  return v_d;
end $$;

-- ---------- Верификация ----------
alter table public.profile_skills add column verified boolean not null default false;

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('selfie', 'university', 'skill')),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'need_docs')),
  note text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index verification_one_pending on public.verification_requests (user_id, kind, coalesce(payload ->> 'skill', '')) where status = 'pending';
alter table public.verification_requests enable row level security;
create policy verification_read on public.verification_requests for select to authenticated using (user_id = auth.uid() or private.is_staff());

create or replace function public.submit_verification(p_kind text, p_payload jsonb, p_files jsonb) returns public.verification_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.verification_requests;
begin
  if p_kind not in ('selfie', 'university', 'skill') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_files, '[]')) = 0 and p_kind <> 'skill' then
    raise exception 'files_required' using errcode = '22023';
  end if;
  if p_kind = 'university' and (not coalesce((p_payload ->> 'consent')::boolean, false) or (p_payload ->> 'university_id') is null) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_kind = 'skill' and not exists (select 1 from public.skills where slug = p_payload ->> 'skill') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.verification_requests (user_id, kind, payload, files)
  values (v_uid, p_kind, coalesce(p_payload, '{}'), private.validate_files(coalesce(p_files, '[]'), v_uid::text || '/'))
  returning * into v;
  return v;
exception when unique_violation then
  raise exception 'already_pending' using errcode = '23505';
end $$;

create or replace function public.admin_verification_decide(p_request uuid, p_status text, p_note text default null) returns public.verification_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v public.verification_requests;
begin
  if p_status not in ('approved', 'rejected', 'need_docs') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.verification_requests set status = p_status, note = p_note, decided_by = v_staff, decided_at = now()
   where id = p_request and status = 'pending' returning * into v;
  if v.id is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if p_status = 'approved' then
    if v.kind = 'selfie' then
      update public.profiles set verified_at = now() where id = v.user_id;
    elsif v.kind = 'university' then
      update public.profiles set university_id = (v.payload ->> 'university_id')::bigint,
             faculty = coalesce(nullif(v.payload ->> 'faculty', ''), faculty)
       where id = v.user_id;
    elsif v.kind = 'skill' then
      insert into public.profile_skills (profile_id, skill_slug, verified, sort)
      values (v.user_id, v.payload ->> 'skill', true, 999)
      on conflict (profile_id, skill_slug) do update set verified = true;
    end if;
  end if;
  perform private.notify(v.user_id, 'verification_' || p_status, v_staff, null, jsonb_build_object('kind', v.kind, 'note', p_note));
  perform private.audit('verification_' || p_status, v.id::text, jsonb_build_object('kind', v.kind));
  return v;
end $$;

-- ---------- Бот PARRI ----------
create table public.bot_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null check (char_length(body) <= 4000),
  tasks jsonb not null default '[]',
  created_at timestamptz not null default clock_timestamp()
);
create index bot_messages_user on public.bot_messages (user_id, id);
alter table public.bot_messages enable row level security;
create policy bot_messages_own on public.bot_messages for select to authenticated using (user_id = auth.uid());

create or replace function public.clear_bot() returns void
language sql security definer set search_path = '' as $$
  delete from public.bot_messages where user_id = auth.uid();
$$;

/** Сохранить реплику бота (Edge Function от имени пользователя) */
create or replace function public.bot_log(p_role text, p_body text, p_tasks jsonb default '[]') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
begin
  if (select plan from public.profiles where id = v_uid) <> 'pro' then
    raise exception 'bot_requires_pro' using errcode = '42501';
  end if;
  insert into public.bot_messages (user_id, role, body, tasks) values (v_uid, p_role, left(p_body, 4000), coalesce(p_tasks, '[]'));
end $$;

-- ---------- Модерация задач ----------
alter table public.tasks add column hidden_at timestamptz, add column hidden_reason text check (char_length(hidden_reason) <= 300);

create or replace function private.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and (
      t.customer_id = auth.uid()
      or t.executor_id = auth.uid()
      or (t.status = 'open' and t.hidden_at is null and (t.kind <> 'campus' or t.university_id = private.my_university_id()))
      or private.has_responded(t.id)
      or private.is_staff()
    )
  )
$$;

drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (
  customer_id = auth.uid()
  or executor_id = auth.uid()
  or (status = 'open' and hidden_at is null and (kind <> 'campus' or university_id = private.my_university_id()))
  or private.has_responded(id)
  or private.is_staff()
);

create or replace function public.admin_hide_task(p_task uuid, p_hide boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_staff uuid := private.require_staff();
begin
  if p_hide and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.tasks set hidden_at = case when p_hide then now() end, hidden_reason = case when p_hide then btrim(p_reason) end where id = p_task;
  perform private.audit(case when p_hide then 'task_hide' else 'task_unhide' end, p_task::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_tasks(p_filter text default 'open', p_query text default null) returns table (
  id uuid, title text, status public.task_status, kind public.task_kind, reward_cents bigint, currency public.money_currency,
  customer_id uuid, customer_name text, hidden_at timestamptz, hidden_reason text, complaints int, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.title, t.status, t.kind, t.reward_cents, t.currency, t.customer_id,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), t.hidden_at, t.hidden_reason,
         (select count(*)::int from public.task_complaints c where c.task_id = t.id), t.created_at
    from public.tasks t join public.profiles p on p.id = t.customer_id
   where private.is_staff()
     and case p_filter when 'hidden' then t.hidden_at is not null
                       when 'cancelled' then t.status = 'archived'
                       when 'reported' then exists (select 1 from public.task_complaints c where c.task_id = t.id)
                       else t.status = 'open' and t.hidden_at is null end
     and (p_query is null or t.title ilike '%' || p_query || '%' or t.id::text = p_query)
   order by t.created_at desc
   limit 200
$$;

-- ---------- Жалобы ----------
create or replace function public.admin_complaint_decide(p_complaint uuid, p_status public.complaint_status) returns void
language plpgsql security definer set search_path = '' as $$
declare v_staff uuid := private.require_staff();
begin
  update public.task_complaints set status = p_status, handled_by = v_staff where id = p_complaint;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  perform private.audit('complaint_' || p_status, p_complaint::text, '{}');
end $$;

create or replace function public.admin_complaints(p_status text default null) returns table (
  id uuid, task_id uuid, task_title text, reporter_name text, reason public.complaint_reason, details text,
  status public.complaint_status, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.task_id, t.title, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), c.reason, c.details, c.status, c.created_at
    from public.task_complaints c join public.tasks t on t.id = c.task_id join public.profiles p on p.id = c.reporter_id
   where private.is_staff() and (p_status is null or c.status::text = p_status)
   order by c.created_at desc
   limit 200
$$;

-- ---------- Пользователи ----------
alter table public.profiles add column banned_reason text check (char_length(banned_reason) <= 300);

create or replace function public.admin_users(p_query text default null) returns table (
  id uuid, name text, username text, email text, role public.user_role, plan public.plan_id, banned_at timestamptz, banned_reason text,
  deactivated_at timestamptz, deleted_at timestamptz, available_cents bigint, usdt_available_cents bigint, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.username::text, u.email::text, p.role, p.plan,
         p.banned_at, p.banned_reason, p.deactivated_at, p.deleted_at,
         coalesce(w.available_cents, 0), coalesce(w.usdt_available_cents, 0), p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.wallets w on w.user_id = p.id
   where private.is_staff()
     and (p_query is null or btrim(p_query) = '' or p.id::text = btrim(p_query) or u.email ilike '%' || btrim(p_query) || '%'
          or p.username::text ilike '%' || btrim(p_query) || '%'
          or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || btrim(p_query) || '%')
   order by p.created_at desc
   limit 100
$$;

/** Тестовое начисление (или списание) с комментарием — в журнал аудита */
create or replace function public.admin_adjust_balance(p_user uuid, p_cents bigint, p_currency public.money_currency, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v_tx uuid := gen_random_uuid();
begin
  if (select role from public.profiles where id = v_staff) <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_cents = 0 or abs(p_cents) > 10000000 or char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.post(v_tx, 'adjustment', 'available', p_user, null, p_cents, left(p_note, 200), p_currency);
  perform private.post(v_tx, 'adjustment', 'external', null, null, -p_cents, left(p_note, 200), p_currency);
  perform private.audit('balance_adjust', p_user::text, jsonb_build_object('cents', p_cents, 'currency', p_currency, 'note', p_note));
end $$;

create or replace function public.admin_restrict_user(p_user uuid, p_restrict boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_staff uuid := private.require_staff();
begin
  if p_user = v_staff then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_restrict and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.profiles
     set banned_at = case when p_restrict then now() end, banned_reason = case when p_restrict then btrim(p_reason) end,
         deactivated_at = case when p_restrict then deactivated_at end
   where id = p_user;
  perform private.audit(case when p_restrict then 'user_restrict' else 'user_activate' end, p_user::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------- Сверка пополнений ----------
/** Зачислить платёж вручную после сверки с провайдером */
create or replace function public.admin_payment_credit(p_payment uuid) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v public.payments;
begin
  select * into v from public.payments where id = p_payment;
  if v.id is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  v := public.svc_payment_succeeded(v.provider_ref, 'manual:' || v_staff::text);
  perform private.audit('payment_credit', p_payment::text, jsonb_build_object('amount_cents', v.amount_cents));
  return v;
end $$;

-- ---------- Дашборд админки ----------
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles where deleted_at is null),
    'users_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'tasks_open', (select count(*) from public.tasks where status = 'open'),
    'tasks_active', (select count(*) from public.tasks where status in ('in_progress', 'review', 'disputed')),
    'tasks_completed', (select count(*) from public.tasks where status = 'completed'),
    'turnover_cents', coalesce((select sum(reward_cents) from public.tasks where status = 'completed' and currency = 'USD'), 0),
    'revenue_cents', coalesce((select sum(amount_cents) from public.ledger_entries where account = 'platform_revenue' and currency = 'USD'), 0),
    'disputes_open', (select count(*) from public.disputes where status in ('pending', 'in_progress')),
    'kyc_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'tickets_open', (select count(*) from public.support_tickets where status = 'open'),
    'payouts_pending', (select count(*) from public.payouts where status in ('requested', 'on_hold')),
    'payments_pending', (select count(*) from public.payments where status = 'pending' and created_at < now() - interval '15 minutes'),
    'complaints_new', (select count(*) from public.task_complaints where status = 'new')
  );
end $$;

-- ---------- Лента без скрытых задач и задач тех, кто в блокировке ----------
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
       and t.hidden_at is null
       and not private.is_blocked_between(t.customer_id, me.uid)
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

-- ---------- Уведомление о решении спора обеим сторонам ----------
create or replace function private.on_dispute_resolved_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.tasks;
begin
  if new.kind = 'system' and new.body = 'dispute_resolved' then
    select * into v from public.tasks where id = new.task_id;
    perform private.notify(v.customer_id, 'dispute_resolved', null, v.id, jsonb_build_object('title', v.title) || coalesce(new.meta, '{}'));
    perform private.notify(v.executor_id, 'dispute_resolved', null, v.id, jsonb_build_object('title', v.title) || coalesce(new.meta, '{}'));
  end if;
  return new;
end $$;
create trigger messages_dispute_resolved after insert on public.messages
  for each row execute function private.on_dispute_resolved_notify();

-- ---------- Хранилище документов: поддержка и проверка личности ----------
-- private-docs: приватный, путь {user_id}/{support|kyc}/{uuid}-{name}, до 10 МБ. Видят владелец и команда.
insert into storage.buckets (id, name, public, file_size_limit)
values ('private-docs', 'private-docs', false, 10485760)
on conflict (id) do nothing;

create policy private_docs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'private-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('support', 'kyc')
);
create policy private_docs_read on storage.objects for select to authenticated using (
  bucket_id = 'private-docs' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_staff())
);

-- ---------- Права ----------
revoke all on function private.require_staff(), private.audit(text, text, jsonb), private.require_user() from public;
grant execute on function private.require_user() to authenticated;
revoke all on function
  public.create_ticket(text, text, text, jsonb, uuid), public.ticket_reply(uuid, text, jsonb, boolean), public.ticket_set_status(uuid, text),
  public.open_dispute(text, uuid, text, text, text[], text, bigint, boolean), public.my_disputes(),
  public.admin_dispute_decide(uuid, text, bigint, text),
  public.submit_verification(text, jsonb, jsonb), public.admin_verification_decide(uuid, text, text),
  public.clear_bot(), public.bot_log(text, text, jsonb),
  public.admin_hide_task(uuid, boolean, text), public.admin_tasks(text, text),
  public.admin_complaint_decide(uuid, public.complaint_status), public.admin_complaints(text),
  public.admin_users(text), public.admin_adjust_balance(uuid, bigint, public.money_currency, text),
  public.admin_restrict_user(uuid, boolean, text), public.admin_payment_credit(uuid), public.admin_stats()
from public, anon;
grant execute on function
  public.create_ticket(text, text, text, jsonb, uuid), public.ticket_reply(uuid, text, jsonb, boolean), public.ticket_set_status(uuid, text),
  public.open_dispute(text, uuid, text, text, text[], text, bigint, boolean), public.my_disputes(),
  public.admin_dispute_decide(uuid, text, bigint, text),
  public.submit_verification(text, jsonb, jsonb), public.admin_verification_decide(uuid, text, text),
  public.clear_bot(), public.bot_log(text, text, jsonb),
  public.admin_hide_task(uuid, boolean, text), public.admin_tasks(text, text),
  public.admin_complaint_decide(uuid, public.complaint_status), public.admin_complaints(text),
  public.admin_users(text), public.admin_adjust_balance(uuid, bigint, public.money_currency, text),
  public.admin_restrict_user(uuid, boolean, text), public.admin_payment_credit(uuid), public.admin_stats()
to authenticated;
grant select on public.support_tickets, public.support_messages, public.dispute_events, public.verification_requests,
  public.bot_messages, public.admin_audit to authenticated;
