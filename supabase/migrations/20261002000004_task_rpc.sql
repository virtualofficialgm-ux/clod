-- Parri · жизненный цикл задачи. Все функции, меняющие состояние или деньги, — security definer
-- с явными проверками прав; функции чтения — security invoker (работает RLS).

alter table public.tasks add column response_count int not null default 0;

-- ---------- Внутренние хелперы ----------
create or replace function private.deadline_minutes(p public.task_deadline) returns int
language sql immutable set search_path = '' as $$
  select case p when '1h' then 60 when '24h' then 1440 when '3d' then 4320 end
$$;

/** Бонус к дедлайну исполнителя по подписке: Pro +15 минут */
create or replace function private.deadline_bonus_minutes(p public.plan_id) returns int
language sql immutable set search_path = '' as $$
  select case p when 'pro' then 15 else 0 end
$$;

create or replace function private.system_message(p_task uuid, p_event text, p_meta jsonb default '{}')
returns void
language sql security definer set search_path = '' as $$
  insert into public.messages (task_id, sender_id, kind, body, meta)
  values (p_task, null, 'system', p_event, coalesce(p_meta, '{}') || jsonb_build_object('event', p_event));
$$;

create or replace function private.lock_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare v public.tasks;
begin
  select * into v from public.tasks where id = p_task for update;
  if v.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  return v;
end $$;

/** Возврат всего Сейфа задачи заказчику (отмена/истечение) */
create or replace function private.refund_escrow(p_task public.tasks, p_kind public.ledger_kind) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_tx uuid := gen_random_uuid();
begin
  select balance_cents into v_balance from public.escrow_accounts where task_id = p_task.id for update;
  if coalesce(v_balance, 0) = 0 then
    return;
  end if;
  perform private.post(v_tx, p_kind, 'escrow', p_task.customer_id, p_task.id, -v_balance);
  perform private.post(v_tx, p_kind, 'available', p_task.customer_id, p_task.id, v_balance);
end $$;

create or replace function private.archive_task(p_task public.tasks, p_reason public.archive_reason)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refund_escrow(p_task, 'task_refund');
  update public.tasks set status = 'archived', archive_reason = p_reason where id = p_task.id;
  update public.task_responses set status = 'rejected'
   where task_id = p_task.id and status = 'pending';
end $$;

create or replace function private.validate_links(p_links text[]) returns void
language plpgsql immutable set search_path = '' as $$
declare l text;
begin
  foreach l in array coalesce(p_links, '{}') loop
    if l !~* '^https?://[^\s]+$' or char_length(l) > 500 then
      raise exception 'invalid_link' using errcode = '22023';
    end if;
  end loop;
end $$;

-- Файлы, загруженные пользователем в свою папку задачи: [{path,name,size,mime}]
create or replace function private.validate_files(p_files jsonb, p_prefix text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare f jsonb;
begin
  if p_files is null then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 10 then
    raise exception 'invalid_files' using errcode = '22023';
  end if;
  for f in select * from jsonb_array_elements(p_files) loop
    if (f ->> 'path') is null or left(f ->> 'path', char_length(p_prefix)) <> p_prefix
       or (f ->> 'path') like '%..%'
       or (f ->> 'name') is null or (f ->> 'size') is null or (f ->> 'mime') is null
       or (f ->> 'size')::bigint > 52428800 then
      raise exception 'invalid_files' using errcode = '22023';
    end if;
  end loop;
  return p_files;
end $$;

-- ---------- Публикация: награда + комиссия списываются в Сейф ----------
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
  p_attachments jsonb default '[]'
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
begin
  select * into v_profile from public.profiles where id = v_uid;

  if p_reward_cents is null or p_reward_cents < 100 or p_reward_cents > 1000000 then
    raise exception 'reward_out_of_range' using errcode = '22023';
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

  v_fee_bps := public.fee_bps_for(v_profile.plan);
  v_fee := public.calc_fee(p_reward_cents, v_fee_bps);

  insert into public.tasks (
    id, customer_id, title, brief, description, category, result_format, checklist, deadline, kind,
    university_id, location, radius_m, place_name, reward_cents, fee_bps, fee_cents, status, expires_at
  ) values (
    p_id, v_uid, btrim(p_title), btrim(p_brief), nullif(btrim(p_description), ''), p_category,
    p_result_format, coalesce(p_checklist, '{}'), p_deadline, p_kind, v_university, v_location,
    case when p_kind = 'nearby' then p_radius_m end,
    case when p_kind = 'nearby' then nullif(btrim(p_place_name), '') end,
    p_reward_cents, v_fee_bps, v_fee, 'open', now() + interval '7 days'
  ) returning * into v_task;

  insert into public.task_attachments (task_id, path, name, size_bytes, mime)
  select v_task.id, f ->> 'path', f ->> 'name', (f ->> 'size')::bigint, f ->> 'mime'
    from jsonb_array_elements(v_files) f;

  -- Сейф: награда + комиссия уходят с баланса заказчика
  perform private.post(v_tx, 'task_lock', 'available', v_uid, v_task.id, -(p_reward_cents + v_fee), 'publish');
  perform private.post(v_tx, 'task_lock', 'escrow', v_uid, v_task.id, p_reward_cents + v_fee, 'publish');

  return v_task;
end $$;

-- ---------- Отмена открытой задачи: полный возврат, включая комиссию ----------
create or replace function public.cancel_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
begin
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'open' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  perform private.archive_task(v, 'cancelled');
  select * into v from public.tasks where id = p_task;
  return v;
end $$;

-- ---------- Истечение срока откликов (cron и ленивый вызов) ----------
create or replace function public.expire_tasks() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.tasks;
  v_count int := 0;
begin
  for v in
    select * from public.tasks where status = 'open' and expires_at <= now()
    for update skip locked
  loop
    perform private.archive_task(v, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------- Повторная публикация просроченной задачи ----------
create or replace function public.republish_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_plan public.plan_id;
  v_fee_bps int;
  v_fee bigint;
  v_tx uuid := gen_random_uuid();
begin
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status = 'open' and v.expires_at <= now() then
    perform private.archive_task(v, 'expired');
    select * into v from public.tasks where id = p_task;
  end if;
  if v.status <> 'archived' or v.archive_reason <> 'expired' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;

  select plan into v_plan from public.profiles where id = v_uid;
  v_fee_bps := public.fee_bps_for(v_plan);
  v_fee := public.calc_fee(v.reward_cents, v_fee_bps);

  perform private.post(v_tx, 'task_lock', 'available', v_uid, v.id, -(v.reward_cents + v_fee), 'republish');
  perform private.post(v_tx, 'task_lock', 'escrow', v_uid, v.id, v.reward_cents + v_fee, 'republish');

  update public.tasks
     set status = 'open', archive_reason = null, fee_bps = v_fee_bps, fee_cents = v_fee,
         published_at = now(), expires_at = now() + interval '7 days',
         executor_id = null, accepted_response_id = null, assigned_at = null, due_at = null
   where id = v.id
  returning * into v;
  return v;
end $$;

-- ---------- Отклики ----------
create or replace function public.submit_response(
  p_task uuid,
  p_cover_letter text,
  p_price_cents bigint,
  p_deadline public.task_deadline,
  p_skills text[] default '{}',
  p_portfolio_links text[] default '{}',
  p_ready public.ready_when default 'now'
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

  select * into v_existing from public.task_responses where task_id = p_task and executor_id = v_uid for update;

  if v_existing.id is null then
    insert into public.task_responses (task_id, executor_id, cover_letter, price_cents, deadline, skills, portfolio_links, ready)
    values (p_task, v_uid, btrim(p_cover_letter), p_price_cents, p_deadline,
            coalesce(p_skills, '{}'), coalesce(p_portfolio_links, '{}'), coalesce(p_ready, 'now'))
    returning * into v_resp;
    update public.tasks set response_count = response_count + 1 where id = p_task;
  elsif v_existing.status = 'withdrawn' then
    update public.task_responses
       set cover_letter = btrim(p_cover_letter), price_cents = p_price_cents, deadline = p_deadline,
           skills = coalesce(p_skills, '{}'), portfolio_links = coalesce(p_portfolio_links, '{}'),
           ready = coalesce(p_ready, 'now'), status = 'pending'
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
  p_ready public.ready_when default 'now'
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
         ready = coalesce(p_ready, 'now')
   where id = p_response
  returning * into v_resp;
  return v_resp;
end $$;

create or replace function public.withdraw_response(p_response uuid) returns public.task_responses
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
  update public.task_responses set status = 'withdrawn' where id = p_response returning * into v_resp;
  update public.tasks set response_count = greatest(response_count - 1, 0) where id = v.id;
  return v_resp;
end $$;

-- ---------- Выбор исполнителя ----------
-- Если цена отклика отличается от награды, разница (с пересчётом комиссии) доплачивается
-- в Сейф с баланса или возвращается из Сейфа на баланс.
create or replace function public.choose_response(p_response uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_resp public.task_responses;
  v public.tasks;
  v_new_fee bigint;
  v_delta bigint;
  v_tx uuid := gen_random_uuid();
  v_exec_plan public.plan_id;
begin
  select * into v_resp from public.task_responses where id = p_response for update;
  if v_resp.id is null then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;
  v := private.lock_task(v_resp.task_id);
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status <> 'open' or v.expires_at <= now() then
    raise exception 'task_not_open' using errcode = '55000';
  end if;
  if v_resp.status <> 'pending' then
    raise exception 'response_not_pending' using errcode = '55000';
  end if;

  v_new_fee := public.calc_fee(v_resp.price_cents, v.fee_bps);
  v_delta := (v_resp.price_cents + v_new_fee) - (v.reward_cents + v.fee_cents);
  if v_delta > 0 then
    perform private.post(v_tx, 'task_adjust', 'available', v_uid, v.id, -v_delta, 'price_change');
    perform private.post(v_tx, 'task_adjust', 'escrow', v_uid, v.id, v_delta, 'price_change');
  elsif v_delta < 0 then
    perform private.post(v_tx, 'task_adjust', 'escrow', v_uid, v.id, v_delta, 'price_change');
    perform private.post(v_tx, 'task_adjust', 'available', v_uid, v.id, -v_delta, 'price_change');
  end if;

  select plan into v_exec_plan from public.profiles where id = v_resp.executor_id;

  update public.task_responses set status = 'accepted' where id = v_resp.id;
  update public.task_responses set status = 'rejected'
   where task_id = v.id and id <> v_resp.id and status = 'pending';

  update public.tasks
     set status = 'in_progress',
         executor_id = v_resp.executor_id,
         accepted_response_id = v_resp.id,
         reward_cents = v_resp.price_cents,
         fee_cents = v_new_fee,
         deadline = v_resp.deadline,
         assigned_at = now(),
         due_at = now() + make_interval(
           mins => private.deadline_minutes(v_resp.deadline) + private.deadline_bonus_minutes(v_exec_plan)
         )
   where id = v.id
  returning * into v;

  perform private.system_message(v.id, 'executor_assigned', jsonb_build_object('executor_id', v.executor_id));
  return v;
end $$;

-- ---------- Сдача работы ----------
create or replace function public.submit_work(
  p_task uuid,
  p_link text default null,
  p_comment text default null,
  p_files jsonb default '[]'
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

  select coalesce(max(version), 0) + 1 into v_version from public.submissions where task_id = p_task;
  insert into public.submissions (task_id, executor_id, version, link, comment, files)
  values (p_task, v_uid, v_version, nullif(btrim(p_link), ''), nullif(btrim(p_comment), ''), v_files)
  returning * into v_sub;

  update public.tasks set status = 'review' where id = p_task;
  perform private.system_message(p_task, 'work_submitted', jsonb_build_object('version', v_version));
  return v_sub;
end $$;

-- ---------- Приёмка ----------
-- accept: все пункты чек-листа отмечены → выплата из Сейфа: награда исполнителю, комиссия платформе.
-- revision / dispute: причина обязательна (отказаться без причины нельзя).
create or replace function public.review_submission(
  p_submission uuid,
  p_decision text,
  p_checklist boolean[] default '{}',
  p_comment text default null
) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_sub public.submissions;
  v public.tasks;
  v_latest int;
  v_escrow bigint;
  v_tx uuid := gen_random_uuid();
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

    perform private.post(v_tx, 'task_release', 'escrow', v.customer_id, v.id, -v_escrow, 'accept');
    perform private.post(v_tx, 'task_release', 'available', v.executor_id, v.id, v.reward_cents, 'reward');
    perform private.post(v_tx, 'task_release', 'platform_revenue', null, v.id, v.fee_cents, 'fee');

    update public.submissions
       set status = 'accepted', checklist_result = p_checklist, review_comment = nullif(btrim(p_comment), ''),
           reviewed_at = now()
     where id = v_sub.id;
    update public.tasks set status = 'completed', completed_at = now() where id = v.id returning * into v;
    update public.profiles
       set completed_count = completed_count + 1, earned_cents = earned_cents + v.reward_cents
     where id = v.executor_id;
    perform private.system_message(v.id, 'work_accepted', jsonb_build_object('reward_cents', v.reward_cents));
  else
    if char_length(btrim(coalesce(p_comment, ''))) < 10 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    if p_decision = 'revision' then
      update public.submissions
         set status = 'revision_requested', checklist_result = p_checklist,
             review_comment = btrim(p_comment), reviewed_at = now()
       where id = v_sub.id;
      update public.tasks set status = 'in_progress' where id = v.id returning * into v;
      perform private.system_message(v.id, 'revision_requested', jsonb_build_object('version', v_sub.version));
    else
      update public.submissions
         set status = 'disputed', checklist_result = p_checklist,
             review_comment = btrim(p_comment), reviewed_at = now()
       where id = v_sub.id;
      update public.tasks set status = 'disputed' where id = v.id returning * into v;
      insert into public.disputes (task_id, submission_id, opened_by, reason)
      values (v.id, v_sub.id, v_uid, btrim(p_comment));
      perform private.system_message(v.id, 'dispute_opened', '{}'::jsonb);
    end if;
  end if;
  return v;
end $$;

-- ---------- Чтение: лента ----------
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
  p_offset int default 0
) returns table (
  id uuid,
  title text,
  brief text,
  category public.task_category,
  result_format public.result_format,
  deadline public.task_deadline,
  kind public.task_kind,
  reward_cents bigint,
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
  has_responded boolean
)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select auth.uid() as uid,
           case when p_lat is not null and p_lng is not null
                then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
           end as point,
           coalesce((
             select array_agg(distinct s.category)
               from public.profile_skills ps join public.skills s on s.slug = ps.skill_slug
              where ps.profile_id = auth.uid()
           ), '{}') as categories
  ),
  base as (
    select t.*, p.first_name, p.last_name, p.avatar_url, p.rating_avg, u.name as uni_name,
           case when me.point is not null and t.location is not null
                then extensions.st_distance(t.location, me.point) end as dist,
           me.categories, me.uid
      from public.tasks t
      cross join me
      join public.profiles p on p.id = t.customer_id
      left join public.universities u on u.id = t.university_id
     where t.status = 'open'
       and t.expires_at > now()
       and t.kind = p_kind
       and t.customer_id <> me.uid
       and (p_kind <> 'nearby' or me.point is not null)
       and (p_query is null or btrim(p_query) = '' or t.title ilike '%' || btrim(p_query) || '%')
       and (p_categories is null or cardinality(p_categories) = 0 or t.category = any (p_categories))
       and (p_min_reward is null or t.reward_cents >= p_min_reward)
       and (p_max_reward is null or t.reward_cents <= p_max_reward)
       and (p_deadlines is null or cardinality(p_deadlines) = 0 or t.deadline = any (p_deadlines))
       and (p_max_distance_m is null or me.point is null or t.location is null
            or extensions.st_dwithin(t.location, me.point, p_max_distance_m))
  )
  select b.id, b.title, b.brief, b.category, b.result_format, b.deadline, b.kind, b.reward_cents,
         b.uni_name, b.place_name, b.radius_m, b.dist,
         extensions.st_y(b.location::extensions.geometry), extensions.st_x(b.location::extensions.geometry),
         b.response_count, b.published_at, b.expires_at, b.customer_id,
         btrim(coalesce(b.first_name, '') || ' ' || left(coalesce(b.last_name, ''), 1) ||
               case when b.last_name is not null then '.' else '' end),
         b.avatar_url, b.rating_avg,
         private.has_responded(b.id)
    from base b
   order by
     case when p_sort = 'recommended' then
       (case when b.category = any (b.categories) then 3 else 0 end)
       + greatest(0, 2 - extract(epoch from now() - b.published_at) / 86400.0)
       + ln(b.reward_cents / 100.0 + 1) / 2
       - coalesce(b.dist / 1000.0, 0)
     end desc nulls last,
     case when p_sort = 'highest_pay' then b.reward_cents end desc nulls last,
     case when p_sort = 'deadline' then private.deadline_minutes(b.deadline) end asc nulls last,
     case when p_sort = 'distance' then b.dist end asc nulls last,
     b.published_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------- Чтение: карточка задачи целиком ----------
create or replace function public.task_detail(p_task uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v public.tasks;
  v_uid uuid := auth.uid();
  v_role text;
  v_result jsonb;
begin
  select * into v from public.tasks where id = p_task;  -- RLS: невидимая задача → null
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
                   'completed_count', p.completed_count)
                   from public.profiles p where p.id = v.customer_id),
    'executor', (select jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
                   'avatar_url', p.avatar_url, 'rating_avg', p.rating_avg, 'rating_count', p.rating_count,
                   'completed_count', p.completed_count)
                   from public.profiles p where p.id = v.executor_id),
    'university', (select jsonb_build_object('id', u.id, 'name', u.name)
                     from public.universities u where u.id = v.university_id),
    'attachments', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at)
                               from public.task_attachments a where a.task_id = v.id), '[]'),
    'my_response', (select to_jsonb(r) from public.task_responses r
                     where r.task_id = v.id and r.executor_id = v_uid),
    'submissions', coalesce((select jsonb_agg(to_jsonb(s) order by s.version desc)
                               from public.submissions s where s.task_id = v.id), '[]'),
    'dispute', (select to_jsonb(d) from public.disputes d
                 where d.task_id = v.id order by d.created_at desc limit 1)
  ) into v_result;
  return v_result;
end $$;

-- ---------- Чтение: отклики для заказчика (сравнение кандидатов) ----------
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
  completed_count int
)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.executor_id, r.cover_letter, r.price_cents, r.deadline, r.skills, r.portfolio_links,
         r.ready, r.status, r.created_at,
         p.first_name, p.last_name, p.avatar_url, p.rating_avg, p.rating_count, p.completed_count
    from public.task_responses r
    join public.profiles p on p.id = r.executor_id
   where r.task_id = p_task
     and private.is_task_customer(p_task)
     and r.status <> 'withdrawn'
   order by (r.status = 'accepted') desc, (r.status = 'pending') desc, r.created_at
$$;

-- ---------- Чтение: мои задачи ----------
create or replace function public.my_tasks(p_role text default 'customer') returns table (
  id uuid,
  title text,
  category public.task_category,
  kind public.task_kind,
  deadline public.task_deadline,
  reward_cents bigint,
  fee_cents bigint,
  status public.task_status,
  archive_reason public.archive_reason,
  expired boolean,
  response_count int,
  due_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  counterpart_name text,
  my_response_status public.response_status
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.title, t.category, t.kind, t.deadline, t.reward_cents, t.fee_cents, t.status,
         t.archive_reason, (t.status = 'open' and t.expires_at <= now()),
         t.response_count, t.due_at, t.expires_at, t.published_at, t.completed_at,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         r.status
    from public.tasks t
    left join public.profiles p
      on p.id = case when p_role = 'customer' then t.executor_id else t.customer_id end
    left join public.task_responses r on r.task_id = t.id and r.executor_id = auth.uid()
   where (p_role = 'customer' and t.customer_id = auth.uid())
      or (p_role = 'executor' and (t.executor_id = auth.uid()
          or (r.id is not null and r.status in ('pending', 'rejected'))))
   order by coalesce(t.due_at, t.published_at) desc
$$;

-- ---------- Права ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.publish_task(uuid, text, text, public.task_category, public.result_format, public.task_deadline, public.task_kind, bigint, text, text[], double precision, double precision, integer, text, jsonb)',
    'public.cancel_task(uuid)',
    'public.republish_task(uuid)',
    'public.submit_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when)',
    'public.update_response(uuid, text, bigint, public.task_deadline, text[], text[], public.ready_when)',
    'public.withdraw_response(uuid)',
    'public.choose_response(uuid)',
    'public.submit_work(uuid, text, text, jsonb)',
    'public.review_submission(uuid, text, boolean[], text)',
    'public.feed_tasks(public.task_kind, text, public.task_category[], bigint, bigint, public.task_deadline[], double precision, double precision, integer, text, integer, integer)',
    'public.task_detail(uuid)',
    'public.task_responses_for(uuid)',
    'public.my_tasks(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke execute on function public.expire_tasks() from public, anon, authenticated;
grant execute on function public.expire_tasks() to service_role;

revoke all on all functions in schema private from public;
grant execute on function private.is_staff(), private.my_university_id(),
  private.is_task_customer(uuid), private.is_task_participant(uuid),
  private.has_responded(uuid), private.can_view_task(uuid), private.deadline_minutes(public.task_deadline)
  to anon, authenticated, service_role;

-- Истечение сроков раз в 5 минут, если в базе есть pg_cron (в Supabase есть)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('parri-expire-tasks', '*/5 * * * *', 'select public.expire_tasks()');
  end if;
end $$;
