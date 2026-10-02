-- Последний блок docx: аналитика, «Рядом» (безопасные места, длительность, приблизительная точка
-- до принятия задачи), чек-ин исполнителя на месте, отметка отправленных push.

-- ---------- Задачи рядом: безопасное место и длительность ----------
alter table public.tasks
  add column safe_place boolean not null default false,
  add column duration_min int check (duration_min between 1 and 1440);

/** Отметить задачу «рядом» как в безопасном месте и указать длительность (заказчик, пока задача открыта) */
create or replace function public.set_nearby_meta(p_task uuid, p_safe boolean, p_duration_min int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
begin
  if v.customer_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.tasks set safe_place = coalesce(p_safe, false), duration_min = p_duration_min where id = v.id;
end $$;

-- ---------- Чек-ин на месте ----------
create table public.task_checkins (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  accuracy_m int,
  distance_m int not null,
  within boolean not null,
  created_at timestamptz not null default now()
);
create index task_checkins_task on public.task_checkins (task_id, created_at);
alter table public.task_checkins enable row level security;
create policy checkins_read on public.task_checkins for select to authenticated using (private.is_task_participant(task_id) or private.is_staff());

/** Исполнитель отмечается на месте: сервер считает расстояние до точки задачи */
create or replace function public.task_checkin(p_task uuid, p_lat double precision, p_lng double precision, p_accuracy_m int default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
  v_point extensions.geography;
  v_dist int;
  v_within boolean;
begin
  if v.executor_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.kind <> 'nearby' or v.location is null then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if v.status not in ('in_progress', 'review') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_dist := round(extensions.st_distance(v.location, v_point))::int;
  -- Допуск: радиус задачи плюс погрешность GPS (не больше 100 м)
  v_within := v_dist <= coalesce(v.radius_m, 250) + least(coalesce(p_accuracy_m, 0), 100);
  insert into public.task_checkins (task_id, user_id, location, accuracy_m, distance_m, within)
  values (v.id, v_uid, v_point, p_accuracy_m, v_dist, v_within);
  perform private.system_message(v.id, case when v_within then 'checked_in' else 'checkin_far' end, jsonb_build_object('distance_m', v_dist));
  return jsonb_build_object('distance_m', v_dist, 'within', v_within);
end $$;

-- ---------- Push: какие уведомления уже отправлены на устройства ----------
alter table public.notifications add column pushed_at timestamptz;

/** Пачка неотправленных push (для Edge Function push-dispatch, только service_role) */
create or replace function public.svc_push_batch(p_limit int default 100) returns table (
  id bigint, user_id uuid, kind text, payload jsonb, actor_name text, task_id uuid, tokens text[]
)
language sql security definer set search_path = '' as $$
  with batch as (
    select n.* from public.notifications n
     join public.profile_private pp on pp.id = n.user_id and pp.notifications_enabled
    where n.pushed_at is null and n.visible_at <= now() and n.created_at > now() - interval '1 day'
      and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
    order by n.id
    limit least(greatest(p_limit, 1), 500)
    for update of n skip locked
  ), marked as (
    update public.notifications n set pushed_at = now() from batch where n.id = batch.id returning n.id
  )
  select b.id, b.user_id, b.kind, b.payload, btrim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), b.task_id,
         array(select token from public.push_tokens t where t.user_id = b.user_id)
    from batch b join marked m on m.id = b.id left join public.profiles a on a.id = b.actor_id
$$;
revoke all on function public.svc_push_batch(int) from public, anon, authenticated;
grant execute on function public.svc_push_batch(int) to service_role;

-- ---------- Аналитика ----------
create or replace function public.my_analytics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_active_user();
begin
  return jsonb_build_object(
    'created', (select count(*) from public.tasks where customer_id = v_uid),
    'taken', (select count(*) from public.tasks where executor_id = v_uid),
    'avg_budget_cents', coalesce((select round(avg(reward_cents)) from public.tasks where customer_id = v_uid and currency = 'USD'), 0),
    'success_rate', coalesce((
      select round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*) filter (where status in ('completed', 'archived') and assigned_at is not null), 0))
        from public.tasks where v_uid in (customer_id, executor_id)), 0),
    'weeks', (
      select jsonb_agg(jsonb_build_object(
               'start', w.start,
               'created', (select count(*) from public.tasks t where t.customer_id = v_uid and t.created_at >= w.start and t.created_at < w.start + interval '7 days'),
               'completed', (select count(*) from public.tasks t where v_uid in (t.customer_id, t.executor_id) and t.completed_at >= w.start and t.completed_at < w.start + interval '7 days'))
             order by w.start)
        from (select date_trunc('week', now()) - make_interval(weeks => g) as start from generate_series(0, 7) g) w),
    'kinds', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) as n from public.tasks where v_uid in (customer_id, executor_id) group by kind) k), '{}'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc)
                              from (select category, count(*) as n from public.tasks where v_uid in (customer_id, executor_id) group by category order by n desc limit 5) c), '[]'),
    'income_usd_cents', coalesce((select sum(amount_cents) from public.ledger_entries where user_id = v_uid and account = 'available' and kind in ('task_release', 'tip') and amount_cents > 0 and currency = 'USD'), 0),
    'income_usdt_cents', coalesce((select sum(amount_cents) from public.ledger_entries where user_id = v_uid and account = 'available' and kind in ('task_release', 'tip') and amount_cents > 0 and currency = 'USDT'), 0),
    'review', (select count(*) from public.tasks where v_uid in (customer_id, executor_id) and status = 'review'),
    'funnel', jsonb_build_object(
      'open', (select count(*) from public.tasks where customer_id = v_uid and status = 'open'),
      'in_progress', (select count(*) from public.tasks where v_uid in (customer_id, executor_id) and status in ('in_progress', 'disputed')),
      'review', (select count(*) from public.tasks where v_uid in (customer_id, executor_id) and status = 'review'),
      'completed', (select count(*) from public.tasks where v_uid in (customer_id, executor_id) and status = 'completed')
    ),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'status', status, 'reward_cents', reward_cents, 'currency', currency) order by created_at desc)
                          from (select * from public.tasks where v_uid in (customer_id, executor_id) order by created_at desc limit 5) r), '[]')
  );
end $$;

-- ---------- Приблизительная точка до принятия задачи ----------
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
         -- До принятия задачи место приблизительное: ~100 м
         round(extensions.st_y(b.location::extensions.geometry)::numeric, 3)::double precision,
         round(extensions.st_x(b.location::extensions.geometry)::numeric, 3)::double precision,
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
        'lat', case when v_role in ('customer', 'executor') then extensions.st_y(v.location::extensions.geometry)
                    else round(extensions.st_y(v.location::extensions.geometry)::numeric, 3)::double precision end,
        'lng', case when v_role in ('customer', 'executor') then extensions.st_x(v.location::extensions.geometry)
                    else round(extensions.st_x(v.location::extensions.geometry)::numeric, 3)::double precision end,
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

revoke all on function public.set_nearby_meta(uuid, boolean, int), public.task_checkin(uuid, double precision, double precision, int), public.my_analytics() from public, anon;
grant execute on function public.set_nearby_meta(uuid, boolean, int), public.task_checkin(uuid, double precision, double precision, int), public.my_analytics() to authenticated;
grant select on public.task_checkins to authenticated;
