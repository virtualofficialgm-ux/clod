-- Parri · деньги. Двойная запись: каждая операция — набор проводок с общим tx_id и суммой 0.
-- Счета: available (свободный баланс пользователя), escrow (Сейф: деньги задачи до приёмки),
-- platform_revenue (комиссия платформы), external (внешний мир: Stripe и т. п.).
-- Балансы в wallets/escrow_accounts — кэш журнала, меняется только функцией private.post().
-- Клиенты не имеют прав на запись ни в одну из этих таблиц.

create type public.ledger_account as enum ('available', 'escrow', 'platform_revenue', 'external');
create type public.ledger_kind as enum (
  'seed', 'topup', 'task_lock', 'task_adjust', 'task_release', 'task_refund', 'withdrawal', 'adjustment'
);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  available_cents bigint not null default 0 check (available_cents >= 0),
  safe_cents bigint not null default 0 check (safe_cents >= 0),
  updated_at timestamptz not null default now()
);

-- Сейф конкретной задачи
create table public.escrow_accounts (
  task_id uuid primary key references public.tasks (id),
  customer_id uuid not null references public.profiles (id),
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  tx_id uuid not null,
  kind public.ledger_kind not null,
  account public.ledger_account not null,
  user_id uuid references public.profiles (id),
  task_id uuid references public.tasks (id),
  amount_cents bigint not null check (amount_cents <> 0),
  memo text,
  created_at timestamptz not null default now(),
  constraint user_accounts_have_user check (account not in ('available', 'escrow') or user_id is not null),
  constraint escrow_has_task check (account <> 'escrow' or task_id is not null)
);
create index ledger_user on public.ledger_entries (user_id, created_at desc);
create index ledger_tx on public.ledger_entries (tx_id);
create index ledger_task on public.ledger_entries (task_id);

-- Сумма проводок каждой транзакции обязана быть нулевой (проверяется при коммите)
create or replace function private.assert_tx_balanced() returns trigger
language plpgsql set search_path = '' as $$
declare v_sum bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_sum from public.ledger_entries where tx_id = new.tx_id;
  if v_sum <> 0 then
    raise exception 'ledger_unbalanced: tx % sums to %', new.tx_id, v_sum using errcode = 'P0001';
  end if;
  return null;
end $$;

create constraint trigger ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function private.assert_tx_balanced();

-- Журнал неизменяем
create or replace function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'ledger_is_append_only' using errcode = 'P0001';
end $$;
create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function private.forbid_change();

-- Кошелёк создаётся вместе с профилем
create or replace function private.create_wallet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profiles_create_wallet after insert on public.profiles
  for each row execute function private.create_wallet();

-- ---------- Комиссия (зеркало packages/shared/src/money.ts) ----------
create or replace function public.fee_bps_for(p_plan public.plan_id) returns int
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 1000 when 'pro' then 1000 end
$$;

/** Комиссия с округлением до цента «половина вверх» */
create or replace function public.calc_fee(p_reward_cents bigint, p_fee_bps int) returns bigint
language sql immutable set search_path = '' as $$
  select (p_reward_cents * p_fee_bps + 5000) / 10000
$$;

/** Доля комиссии к возврату при частичном возврате награды (округление вниз) */
create or replace function public.proportional_fee_refund(
  p_fee_cents bigint, p_reward_cents bigint, p_refunded_reward_cents bigint
) returns bigint
language sql immutable set search_path = '' as $$
  select case when p_reward_cents = 0 then 0 else (p_fee_cents * p_refunded_reward_cents) / p_reward_cents end
$$;

-- ---------- Проводка ----------
create or replace function private.post(
  p_tx uuid,
  p_kind public.ledger_kind,
  p_account public.ledger_account,
  p_user uuid,
  p_task uuid,
  p_amount bigint,
  p_memo text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then
    return;
  end if;

  if p_account = 'available' then
    select available_cents into v_balance from public.wallets where user_id = p_user for update;
    if v_balance is null then
      raise exception 'wallet_not_found' using errcode = 'P0002';
    end if;
    if v_balance + p_amount < 0 then
      raise exception 'insufficient_funds' using errcode = 'P0001';
    end if;
    update public.wallets
       set available_cents = available_cents + p_amount, updated_at = now()
     where user_id = p_user;
  elsif p_account = 'escrow' then
    insert into public.escrow_accounts (task_id, customer_id, balance_cents)
      values (p_task, p_user, 0)
      on conflict (task_id) do nothing;
    update public.escrow_accounts
       set balance_cents = balance_cents + p_amount, updated_at = now()
     where task_id = p_task and customer_id = p_user
    returning balance_cents into v_balance;
    if v_balance is null or v_balance < 0 then
      raise exception 'escrow_mismatch' using errcode = 'P0001';
    end if;
    update public.wallets
       set safe_cents = safe_cents + p_amount, updated_at = now()
     where user_id = p_user;
  end if;

  insert into public.ledger_entries (tx_id, kind, account, user_id, task_id, amount_cents, memo)
  values (p_tx, p_kind, p_account, p_user, p_task, p_amount, p_memo);
end $$;

-- ---------- RLS ----------
alter table public.wallets enable row level security;
alter table public.escrow_accounts enable row level security;
alter table public.ledger_entries enable row level security;

create policy wallets_own on public.wallets for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
create policy escrow_own on public.escrow_accounts for select to authenticated
  using (customer_id = auth.uid() or private.is_staff());
-- Пользователь видит только свои проводки по счетам available/escrow
create policy ledger_own on public.ledger_entries for select to authenticated
  using ((user_id = auth.uid() and account in ('available', 'escrow')) or private.is_staff());

revoke all on public.wallets, public.escrow_accounts, public.ledger_entries from anon;
revoke insert, update, delete, truncate on public.wallets, public.escrow_accounts, public.ledger_entries
  from authenticated;
grant select on public.wallets, public.escrow_accounts, public.ledger_entries to authenticated;

-- ---------- Тестовое пополнение (только сервер: сиды и dev-инструменты) ----------
-- На этапе 4 пополнение будет идти только из вебхука Stripe.
create or replace function public.dev_credit(p_user uuid, p_amount_cents bigint, p_memo text default 'test credit')
returns void
language plpgsql security definer set search_path = '' as $$
declare v_tx uuid := gen_random_uuid();
begin
  if p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  perform private.post(v_tx, 'seed', 'external', null, null, -p_amount_cents, p_memo);
  perform private.post(v_tx, 'seed', 'available', p_user, null, p_amount_cents, p_memo);
end $$;
revoke execute on function public.dev_credit(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.dev_credit(uuid, bigint, text) to service_role;

revoke all on all functions in schema private from public;
grant execute on function private.is_staff(), private.my_university_id(),
  private.is_task_customer(uuid), private.is_task_participant(uuid),
  private.has_responded(uuid), private.can_view_task(uuid)
  to anon, authenticated, service_role;
