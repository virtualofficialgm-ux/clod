-- Parri · список чатов: чат существует у каждой задачи с выбранным исполнителем.
-- Отметки о прочтении — для счётчиков непрочитанных и статуса «Прочитано».

create table public.chat_reads (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.chat_reads enable row level security;
-- Участник видит отметки обоих (нужно для «Прочитано»), пишет только через RPC
create policy chat_reads_read on public.chat_reads for select to authenticated
  using (private.is_task_participant(task_id) or private.is_staff());
revoke all on public.chat_reads from anon;
revoke insert, update, delete on public.chat_reads from authenticated;
grant select on public.chat_reads to authenticated;

create or replace function public.mark_chat_read(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_task_participant(p_task) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.chat_reads (task_id, user_id, last_read_at) values (p_task, auth.uid(), now())
  on conflict (task_id, user_id) do update set last_read_at = excluded.last_read_at;
end $$;

create or replace function public.my_chats() returns table (
  task_id uuid,
  title text,
  status public.task_status,
  reward_cents bigint,
  due_at timestamptz,
  role text,
  counterpart_id uuid,
  counterpart_name text,
  counterpart_avatar text,
  last_body text,
  last_kind public.message_kind,
  last_sender uuid,
  last_at timestamptz,
  unread int,
  counterpart_read_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.title, t.status, t.reward_cents, t.due_at,
         case when t.customer_id = auth.uid() then 'customer' else 'executor' end,
         p.id,
         btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         p.avatar_url,
         lm.body, lm.kind, lm.sender_id, coalesce(lm.created_at, t.assigned_at),
         (select count(*)::int from public.messages m
           where m.task_id = t.id and m.sender_id is distinct from auth.uid()
             and m.created_at > coalesce(mine.last_read_at, '-infinity')),
         theirs.last_read_at
    from public.tasks t
    join public.profiles p
      on p.id = case when t.customer_id = auth.uid() then t.executor_id else t.customer_id end
    left join lateral (
      select m.body, m.kind, m.sender_id, m.created_at from public.messages m
       where m.task_id = t.id order by m.created_at desc limit 1
    ) lm on true
    left join public.chat_reads mine on mine.task_id = t.id and mine.user_id = auth.uid()
    left join public.chat_reads theirs on theirs.task_id = t.id and theirs.user_id = p.id
   where t.executor_id is not null and auth.uid() in (t.customer_id, t.executor_id)
   order by coalesce(lm.created_at, t.assigned_at) desc nulls last
$$;

revoke execute on function public.mark_chat_read(uuid), public.my_chats() from public, anon;
grant execute on function public.mark_chat_read(uuid), public.my_chats() to authenticated;
