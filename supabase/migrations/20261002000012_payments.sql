-- Parri · этап 4: деньги по правилам theparri.com.
--  * Комиссия за публикацию по шкале от суммы: до $49.99 — 5%, от $50 — 4%, от $100 — 3,5%,
--    от $200 — 3%, от $500 — 2,5%. Платит заказчик сверху, исполнитель получает награду целиком.
--  * Два счёта: USD и USDT. Рубли — только для отображения по курсу ЦБ (fx_rates).
--  * Баланс меняется только серверными функциями: пополнение — после вебхука Stripe/NOWPayments,
--    вывод — удержание (hold) при заявке, списание после выплаты, возврат при отказе.
--  * Лимиты вывода: минимум $10 (карта) / 20 USDT, не чаще раза в час, не больше $1000 в сутки, только 18+.

create type public.money_currency as enum ('USD', 'USDT');
create type public.payment_kind as enum ('topup', 'subscription');
create type public.payment_provider as enum ('stripe', 'nowpayments', 'manual');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded');
create type public.payout_method as enum ('stripe', 'usdt');
create type public.payout_status as enum ('requested', 'on_hold', 'approved', 'processing', 'paid', 'failed', 'rejected');
create type public.crypto_network as enum ('TRC20', 'ERC20', 'BEP20');
create type public.refund_reason as enum ('not_provided', 'double_charge', 'unknown', 'other');
create type public.refund_status as enum ('created', 'reviewing', 'refunded', 'rejected');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid');
create type public.billing_interval as enum ('month', 'year');

-- ---------- Комиссия по шкале (зеркало packages/shared/src/money.ts) ----------
create or replace function public.fee_bps_for_reward(p_reward_cents bigint) returns int
language sql immutable set search_path = '' as $$
  select case
    when p_reward_cents >= 50000 then 250
    when p_reward_cents >= 20000 then 300
    when p_reward_cents >= 10000 then 350
    when p_reward_cents >= 5000 then 400
    else 500
  end
$$;

-- ---------- Валюта в журнале, кошельках и Сейфе ----------
alter table public.ledger_entries add column currency public.money_currency not null default 'USD';
alter table public.ledger_entries drop constraint if exists user_accounts_have_user;
alter table public.ledger_entries add constraint user_accounts_have_user
  check (account not in ('available', 'escrow', 'hold') or user_id is not null);

alter table public.wallets
  add column held_cents bigint not null default 0 check (held_cents >= 0),
  add column usdt_available_cents bigint not null default 0 check (usdt_available_cents >= 0),
  add column usdt_safe_cents bigint not null default 0 check (usdt_safe_cents >= 0),
  add column usdt_held_cents bigint not null default 0 check (usdt_held_cents >= 0);

alter table public.escrow_accounts add column currency public.money_currency not null default 'USD';

alter table public.tasks
  add column currency public.money_currency not null default 'USD',
  add column input_currency text check (input_currency in ('USD', 'RUB', 'USDT')),
  add column input_amount bigint check (input_amount > 0);

-- Баланс транзакции проверяется по каждой валюте отдельно
create or replace function private.assert_tx_balanced() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_bad record;
begin
  select currency, sum(amount_cents) as s into v_bad
    from public.ledger_entries where tx_id = new.tx_id
   group by currency having sum(amount_cents) <> 0 limit 1;
  if found then
    raise exception 'ledger_unbalanced: tx % sums to % %', new.tx_id, v_bad.s, v_bad.currency using errcode = 'P0001';
  end if;
  return null;
end $$;

-- Проводка с валютой. Старый вызов (7 аргументов) по-прежнему работает — валюта по умолчанию USD.
drop function if exists private.post(uuid, public.ledger_kind, public.ledger_account, uuid, uuid, bigint, text);
create or replace function private.post(
  p_tx uuid,
  p_kind public.ledger_kind,
  p_account public.ledger_account,
  p_user uuid,
  p_task uuid,
  p_amount bigint,
  p_memo text default null,
  p_currency public.money_currency default 'USD'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_usd boolean := p_currency = 'USD';
begin
  if p_amount = 0 then
    return;
  end if;

  if p_account = 'available' then
    select case when v_usd then available_cents else usdt_available_cents end into v_balance
      from public.wallets where user_id = p_user for update;
    if v_balance is null then
      raise exception 'wallet_not_found' using errcode = 'P0002';
    end if;
    if v_balance + p_amount < 0 then
      raise exception 'insufficient_funds' using errcode = 'P0001';
    end if;
    if v_usd then
      update public.wallets set available_cents = available_cents + p_amount, updated_at = now() where user_id = p_user;
    else
      update public.wallets set usdt_available_cents = usdt_available_cents + p_amount, updated_at = now() where user_id = p_user;
    end if;
  elsif p_account = 'hold' then
    select case when v_usd then held_cents else usdt_held_cents end into v_balance
      from public.wallets where user_id = p_user for update;
    if v_balance is null or v_balance + p_amount < 0 then
      raise exception 'hold_mismatch' using errcode = 'P0001';
    end if;
    if v_usd then
      update public.wallets set held_cents = held_cents + p_amount, updated_at = now() where user_id = p_user;
    else
      update public.wallets set usdt_held_cents = usdt_held_cents + p_amount, updated_at = now() where user_id = p_user;
    end if;
  elsif p_account = 'escrow' then
    insert into public.escrow_accounts (task_id, customer_id, balance_cents, currency)
      values (p_task, p_user, 0, p_currency)
      on conflict (task_id) do nothing;
    update public.escrow_accounts
       set balance_cents = balance_cents + p_amount, updated_at = now()
     where task_id = p_task and customer_id = p_user and currency = p_currency
    returning balance_cents into v_balance;
    if v_balance is null or v_balance < 0 then
      raise exception 'escrow_mismatch' using errcode = 'P0001';
    end if;
    if v_usd then
      update public.wallets set safe_cents = safe_cents + p_amount, updated_at = now() where user_id = p_user;
    else
      update public.wallets set usdt_safe_cents = usdt_safe_cents + p_amount, updated_at = now() where user_id = p_user;
    end if;
  end if;

  insert into public.ledger_entries (tx_id, kind, account, user_id, task_id, amount_cents, memo, currency)
  values (p_tx, p_kind, p_account, p_user, p_task, p_amount, p_memo, p_currency);
end $$;

-- Пользователь видит свои проводки по счетам available/escrow/hold
drop policy if exists ledger_own on public.ledger_entries;
create policy ledger_own on public.ledger_entries for select to authenticated
  using ((user_id = auth.uid() and account in ('available', 'escrow', 'hold')) or private.is_staff());

-- ---------- Курсы валют (для отображения и пересчёта рублёвой цены) ----------
create table public.fx_rates (
  currency text primary key check (currency ~ '^[A-Z]{3,4}$'),
  per_usd numeric(14, 6) not null check (per_usd > 0),
  source text not null default 'seed',
  fetched_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);
revoke insert, update, delete on public.fx_rates from anon, authenticated;
-- Стартовые значения: обновляются функцией fx-rates (ЦБ РФ) по расписанию
insert into public.fx_rates (currency, per_usd, source) values
  ('USD', 1, 'fixed'), ('USDT', 1, 'fixed'), ('RUB', 81.5, 'seed'), ('EUR', 0.86, 'seed'),
  ('AED', 3.6725, 'seed'), ('KZT', 535, 'seed');

create or replace function public.svc_set_rates(p_rates jsonb, p_source text default 'cbr') returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  insert into public.fx_rates (currency, per_usd, source, fetched_at)
  select key, value::numeric, p_source, now() from jsonb_each_text(p_rates)
   where key not in ('USD', 'USDT') and value::numeric > 0
  on conflict (currency) do update set per_usd = excluded.per_usd, source = excluded.source, fetched_at = excluded.fetched_at;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------- Публикация: шкала комиссии, валюта, идемпотентность, курс рубля ----------
drop function if exists public.publish_task(uuid, text, text, public.task_category, public.result_format,
  public.task_deadline, public.task_kind, bigint, text, text[], double precision, double precision, integer, text, jsonb);

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
  p_rate_fetched_at timestamptz default null
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
    currency, input_currency, input_amount
  ) values (
    p_id, v_uid, btrim(p_title), btrim(p_brief), nullif(btrim(p_description), ''), p_category,
    p_result_format, coalesce(p_checklist, '{}'), p_deadline, p_kind, v_university, v_location,
    case when p_kind = 'nearby' then p_radius_m end,
    case when p_kind = 'nearby' then nullif(btrim(p_place_name), '') end,
    p_reward_cents, v_fee_bps, v_fee, 'open', now() + interval '7 days',
    p_currency, coalesce(p_input_currency, p_currency::text), coalesce(p_input_amount, p_reward_cents)
  ) returning * into v_task;

  insert into public.task_attachments (task_id, path, name, size_bytes, mime)
  select v_task.id, f ->> 'path', f ->> 'name', (f ->> 'size')::bigint, f ->> 'mime'
    from jsonb_array_elements(v_files) f;

  -- Сейф: награда + комиссия уходят с баланса заказчика в валюте задачи
  perform private.post(v_tx, 'task_lock', 'available', v_uid, v_task.id, -(p_reward_cents + v_fee), 'publish', p_currency);
  perform private.post(v_tx, 'task_lock', 'escrow', v_uid, v_task.id, p_reward_cents + v_fee, 'publish', p_currency);

  return v_task;
end $$;

-- Возврат Сейфа — в валюте задачи
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
  perform private.post(v_tx, p_kind, 'escrow', p_task.customer_id, p_task.id, -v_balance, null, p_task.currency);
  perform private.post(v_tx, p_kind, 'available', p_task.customer_id, p_task.id, v_balance, null, p_task.currency);
end $$;

-- Повторная публикация: комиссия по шкале на текущую награду
create or replace function public.republish_task(p_task uuid) returns public.tasks
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v public.tasks := private.lock_task(p_task);
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
  if v.status <> 'archived' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;

  v_fee_bps := public.fee_bps_for_reward(v.reward_cents);
  v_fee := public.calc_fee(v.reward_cents, v_fee_bps);

  perform private.post(v_tx, 'task_lock', 'available', v_uid, v.id, -(v.reward_cents + v_fee), 'republish', v.currency);
  perform private.post(v_tx, 'task_lock', 'escrow', v_uid, v.id, v.reward_cents + v_fee, 'republish', v.currency);

  update public.tasks
     set status = 'open', archive_reason = null, fee_bps = v_fee_bps, fee_cents = v_fee,
         published_at = now(), expires_at = now() + interval '7 days',
         executor_id = null, accepted_response_id = null, assigned_at = null, due_at = null, completed_at = null
   where id = v.id
  returning * into v;
  return v;
end $$;

-- ---------- Платежи (пополнения и подписка) ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind public.payment_kind not null,
  provider public.payment_provider not null,
  currency public.money_currency not null default 'USD',
  -- Сумма к зачислению на баланс (для пополнения) или цена подписки
  amount_cents bigint not null check (amount_cents > 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  status public.payment_status not null default 'pending',
  provider_ref text unique,
  provider_payment text,
  network public.crypto_network,
  pay_address text,
  pay_amount text,
  failure_reason text,
  meta jsonb not null default '{}',
  credited_tx uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_not_more check (refunded_cents <= amount_cents)
);
create index payments_user on public.payments (user_id, created_at desc);
create trigger payments_touch before update on public.payments for each row execute function private.touch_updated_at();

-- Идемпотентность вебхуков: каждое событие обрабатывается один раз
create table public.provider_events (
  id text primary key,
  provider public.payment_provider not null,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.stripe_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  customer_id text not null unique
);

create table public.connect_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_id text not null unique,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.crypto_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  network public.crypto_network not null,
  address text not null check (char_length(address) between 20 and 100 and address ~ '^[A-Za-z0-9]+$'),
  label text check (char_length(label) <= 40),
  created_at timestamptz not null default now(),
  unique (user_id, network, address)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  method public.payout_method not null,
  currency public.money_currency not null,
  amount_cents bigint not null check (amount_cents > 0),
  status public.payout_status not null default 'requested',
  network public.crypto_network,
  address text,
  provider_ref text,
  failure_reason text,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usdt_needs_address check (method <> 'usdt' or (network is not null and address is not null))
);
create index payouts_user on public.payouts (user_id, created_at desc);
create index payouts_queue on public.payouts (status, created_at);
create trigger payouts_touch before update on public.payouts for each row execute function private.touch_updated_at();

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan public.plan_id not null default 'pro',
  billing_interval public.billing_interval not null,
  status public.subscription_status not null,
  subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) default auth.uid(),
  payment_id uuid references public.payments (id),
  ledger_tx uuid,
  reason public.refund_reason not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency public.money_currency not null default 'USD',
  details text not null check (char_length(btrim(details)) between 10 and 2000),
  status public.refund_status not null default 'created',
  resolution text,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_target check (payment_id is not null or ledger_tx is not null)
);
create index refund_requests_user on public.refund_requests (user_id, created_at desc);
create trigger refund_requests_touch before update on public.refund_requests for each row execute function private.touch_updated_at();

-- ---------- RLS: пользователь видит своё, пишет только через RPC ----------
alter table public.payments enable row level security;
alter table public.provider_events enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.connect_accounts enable row level security;
alter table public.crypto_addresses enable row level security;
alter table public.payouts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.refund_requests enable row level security;

create policy payments_own on public.payments for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy connect_own on public.connect_accounts for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy payouts_own on public.payouts for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy subscriptions_own on public.subscriptions for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy refunds_own on public.refund_requests for select to authenticated using (user_id = auth.uid() or private.is_staff());
create policy crypto_addresses_own on public.crypto_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.payments, public.provider_events, public.stripe_customers, public.connect_accounts,
  public.crypto_addresses, public.payouts, public.subscriptions, public.refund_requests from anon;
revoke insert, update, delete on public.payments, public.provider_events, public.stripe_customers,
  public.connect_accounts, public.payouts, public.subscriptions, public.refund_requests from authenticated;
revoke all on public.provider_events, public.stripe_customers from authenticated;
grant select on public.payments, public.connect_accounts, public.payouts, public.subscriptions, public.refund_requests to authenticated;
grant select, insert, delete on public.crypto_addresses to authenticated;

-- ---------- Константы лимитов (зеркало packages/shared/src/money.ts) ----------
create or replace function private.payout_min_cents(p_method public.payout_method) returns bigint
language sql immutable set search_path = '' as $$
  select case p_method when 'stripe' then 1000 else 2000 end
$$;
create or replace function private.topup_min_cents(p_provider public.payment_provider) returns bigint
language sql immutable set search_path = '' as $$
  select case p_provider when 'nowpayments' then 2000 else 500 end
$$;

-- ---------- Заявка на вывод ----------
create or replace function public.request_payout(
  p_method public.payout_method,
  p_amount_cents bigint,
  p_network public.crypto_network default null,
  p_address text default null,
  p_confirmed boolean default false
) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_birth date;
  v_currency public.money_currency := case p_method when 'usdt' then 'USDT'::public.money_currency else 'USD' end;
  v_payout public.payouts;
  v_today bigint;
  v_tx uuid := gen_random_uuid();
begin
  if not coalesce(p_confirmed, false) then
    raise exception 'confirm_required' using errcode = '22023';
  end if;
  select birth_date into v_birth from public.profile_private where id = v_uid;
  if v_birth is null or public.age_years(v_birth) < 18 then
    raise exception 'payout_age_18' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < private.payout_min_cents(p_method) then
    raise exception 'payout_below_min' using errcode = '22023';
  end if;
  if p_method = 'stripe' and not exists (
    select 1 from public.connect_accounts where user_id = v_uid and payouts_enabled
  ) then
    raise exception 'payouts_not_setup' using errcode = '55000';
  end if;
  if p_method = 'usdt' then
    if p_network is null or coalesce(p_address, '') !~ '^[A-Za-z0-9]{20,100}$' then
      raise exception 'invalid_address' using errcode = '22023';
    end if;
  end if;

  -- Не чаще одной заявки в час
  perform 1 from public.wallets where user_id = v_uid for update;
  if exists (
    select 1 from public.payouts where user_id = v_uid and created_at > now() - interval '1 hour'
       and status not in ('rejected', 'failed')
  ) then
    raise exception 'payout_rate_limited' using errcode = '54000';
  end if;
  -- Не больше $1000 в сутки (USDT считается 1:1)
  select coalesce(sum(amount_cents), 0) into v_today from public.payouts
   where user_id = v_uid and created_at > now() - interval '24 hours' and status not in ('rejected', 'failed');
  if v_today + p_amount_cents > 100000 then
    raise exception 'payout_daily_limit' using errcode = '54000';
  end if;

  insert into public.payouts (user_id, method, currency, amount_cents, network, address)
  values (v_uid, p_method, v_currency, p_amount_cents, p_network, nullif(btrim(p_address), ''))
  returning * into v_payout;

  -- Деньги удерживаются до выплаты
  perform private.post(v_tx, 'payout_hold', 'available', v_uid, null, -p_amount_cents, v_payout.id::text, v_currency);
  perform private.post(v_tx, 'payout_hold', 'hold', v_uid, null, p_amount_cents, v_payout.id::text, v_currency);
  return v_payout;
end $$;

-- ---------- Запрос возврата ----------
create or replace function public.request_refund(
  p_payment uuid,
  p_ledger_tx uuid,
  p_reason public.refund_reason,
  p_amount_cents bigint,
  p_details text
) returns public.refund_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_active_user();
  v_payment public.payments;
  v_currency public.money_currency := 'USD';
  v_r public.refund_requests;
begin
  if p_payment is not null then
    select * into v_payment from public.payments where id = p_payment and user_id = v_uid;
    if v_payment.id is null then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_payment.status not in ('succeeded', 'partially_refunded') then
      raise exception 'invalid_status' using errcode = '55000';
    end if;
    if p_amount_cents > v_payment.amount_cents - v_payment.refunded_cents then
      raise exception 'refund_too_big' using errcode = '22023';
    end if;
    v_currency := v_payment.currency;
  elsif p_ledger_tx is not null then
    if not exists (select 1 from public.ledger_entries where tx_id = p_ledger_tx and user_id = v_uid) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'refund_target_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.refund_requests where user_id = v_uid and status in ('created', 'reviewing')
       and (payment_id = p_payment or ledger_tx = p_ledger_tx)
  ) then
    raise exception 'refund_already_requested' using errcode = '23505';
  end if;

  insert into public.refund_requests (user_id, payment_id, ledger_tx, reason, amount_cents, currency, details)
  values (v_uid, p_payment, p_ledger_tx, p_reason, p_amount_cents, v_currency, btrim(p_details))
  returning * into v_r;
  return v_r;
end $$;

-- ==================================================================================
-- Сервисные функции: вызываются только Edge Functions (service_role) после проверки
-- подписи вебхука. Каждая идемпотентна.
-- ==================================================================================

/** Записать событие провайдера; false — уже обработано */
create or replace function public.svc_event_begin(p_id text, p_provider public.payment_provider, p_type text, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_done timestamptz;
begin
  insert into public.provider_events (id, provider, type, payload) values (p_id, p_provider, p_type, p_payload)
  on conflict (id) do nothing;
  select processed_at into v_done from public.provider_events where id = p_id for update;
  return v_done is null;
end $$;

create or replace function public.svc_event_done(p_id text) returns void
language sql security definer set search_path = '' as $$
  update public.provider_events set processed_at = now() where id = p_id;
$$;

create or replace function public.svc_payment_create(
  p_user uuid, p_kind public.payment_kind, p_provider public.payment_provider, p_currency public.money_currency,
  p_amount_cents bigint, p_provider_ref text, p_meta jsonb default '{}',
  p_network public.crypto_network default null, p_pay_address text default null, p_pay_amount text default null
) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare v public.payments;
begin
  if p_kind = 'topup' and p_amount_cents < private.topup_min_cents(p_provider) then
    raise exception 'topup_below_min' using errcode = '22023';
  end if;
  if p_amount_cents > 1000000 then
    raise exception 'topup_above_max' using errcode = '22023';
  end if;
  insert into public.payments (user_id, kind, provider, currency, amount_cents, provider_ref, meta, network, pay_address, pay_amount)
  values (p_user, p_kind, p_provider, p_currency, p_amount_cents, p_provider_ref, coalesce(p_meta, '{}'), p_network, p_pay_address, p_pay_amount)
  returning * into v;
  return v;
end $$;

/** Оплата прошла: пополнение зачисляется на баланс ровно один раз */
create or replace function public.svc_payment_succeeded(p_provider_ref text, p_provider_payment text default null)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v public.payments;
  v_tx uuid := gen_random_uuid();
begin
  select * into v from public.payments where provider_ref = p_provider_ref for update;
  if v.id is null then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'pending' then
    return v;
  end if;
  if v.kind = 'topup' then
    perform private.post(v_tx, 'topup', 'external', null, null, -v.amount_cents, v.id::text, v.currency);
    perform private.post(v_tx, 'topup', 'available', v.user_id, null, v.amount_cents, v.id::text, v.currency);
  end if;
  update public.payments
     set status = 'succeeded', provider_payment = coalesce(p_provider_payment, provider_payment),
         credited_tx = case when v.kind = 'topup' then v_tx end
   where id = v.id
  returning * into v;
  return v;
end $$;

create or replace function public.svc_payment_failed(p_provider_ref text, p_reason text default null, p_canceled boolean default false)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare v public.payments;
begin
  update public.payments
     set status = case when p_canceled then 'canceled'::public.payment_status else 'failed' end,
         failure_reason = left(p_reason, 500)
   where provider_ref = p_provider_ref and status = 'pending'
  returning * into v;
  if v.id is null then
    select * into v from public.payments where provider_ref = p_provider_ref;
  end if;
  return v;
end $$;

create or replace function public.svc_customer_upsert(p_user uuid, p_customer text) returns void
language sql security definer set search_path = '' as $$
  insert into public.stripe_customers (user_id, customer_id) values (p_user, p_customer)
  on conflict (user_id) do update set customer_id = excluded.customer_id;
$$;

create or replace function public.svc_connect_update(p_user uuid, p_account text, p_details boolean, p_payouts boolean)
returns void
language sql security definer set search_path = '' as $$
  insert into public.connect_accounts (user_id, account_id, details_submitted, payouts_enabled, updated_at)
  values (p_user, p_account, coalesce(p_details, false), coalesce(p_payouts, false), now())
  on conflict (user_id) do update set account_id = excluded.account_id,
    details_submitted = excluded.details_submitted, payouts_enabled = excluded.payouts_enabled, updated_at = now();
$$;

create or replace function public.svc_connect_update_by_account(p_account text, p_details boolean, p_payouts boolean)
returns void
language sql security definer set search_path = '' as $$
  update public.connect_accounts set details_submitted = coalesce(p_details, false),
    payouts_enabled = coalesce(p_payouts, false), updated_at = now()
   where account_id = p_account;
$$;

/** Выплата ушла провайдеру */
create or replace function public.svc_payout_processing(p_payout uuid, p_provider_ref text) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare v public.payouts;
begin
  update public.payouts set status = 'processing', provider_ref = p_provider_ref
   where id = p_payout and status in ('approved', 'processing')
  returning * into v;
  if v.id is null then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  return v;
end $$;

/** Выплата дошла: удержание списывается во внешний мир */
create or replace function public.svc_payout_paid(p_payout uuid) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare
  v public.payouts;
  v_tx uuid := gen_random_uuid();
begin
  select * into v from public.payouts where id = p_payout for update;
  if v.id is null then
    raise exception 'payout_not_found' using errcode = 'P0002';
  end if;
  if v.status = 'paid' then
    return v;
  end if;
  if v.status not in ('approved', 'processing') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  perform private.post(v_tx, 'payout_paid', 'hold', v.user_id, null, -v.amount_cents, v.id::text, v.currency);
  perform private.post(v_tx, 'payout_paid', 'external', null, null, v.amount_cents, v.id::text, v.currency);
  update public.payouts set status = 'paid' where id = v.id returning * into v;
  return v;
end $$;

/** Выплата не прошла или отклонена: удержание возвращается на баланс */
create or replace function private.payout_return(v public.payouts, p_status public.payout_status, p_reason text)
returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare v_tx uuid := gen_random_uuid();
begin
  perform private.post(v_tx, 'payout_return', 'hold', v.user_id, null, -v.amount_cents, v.id::text, v.currency);
  perform private.post(v_tx, 'payout_return', 'available', v.user_id, null, v.amount_cents, v.id::text, v.currency);
  update public.payouts set status = p_status, failure_reason = left(p_reason, 500) where id = v.id returning * into v;
  return v;
end $$;

create or replace function public.svc_payout_failed(p_payout uuid, p_reason text) returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare v public.payouts;
begin
  select * into v from public.payouts where id = p_payout for update;
  if v.id is null then
    raise exception 'payout_not_found' using errcode = 'P0002';
  end if;
  if v.status in ('failed', 'rejected') then
    return v;
  end if;
  if v.status = 'paid' then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  return private.payout_return(v, 'failed', p_reason);
end $$;

/** Решение модератора по заявке на вывод: одобрить, удержать, отклонить */
create or replace function public.admin_payout_decide(p_payout uuid, p_decision text, p_reason text default null)
returns public.payouts
language plpgsql security definer set search_path = '' as $$
declare v public.payouts;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v from public.payouts where id = p_payout for update;
  if v.id is null then
    raise exception 'payout_not_found' using errcode = 'P0002';
  end if;
  if v.status not in ('requested', 'on_hold') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_decision = 'approve' then
    update public.payouts set status = 'approved', reviewed_by = auth.uid() where id = v.id returning * into v;
  elsif p_decision = 'hold' then
    update public.payouts set status = 'on_hold', reviewed_by = auth.uid(), failure_reason = left(p_reason, 500)
     where id = v.id returning * into v;
  elsif p_decision = 'reject' then
    if char_length(btrim(coalesce(p_reason, ''))) < 5 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    update public.payouts set reviewed_by = auth.uid() where id = v.id;
    v := private.payout_return(v, 'rejected', p_reason);
  else
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  return v;
end $$;

/** Подписка изменилась (Checkout, продление, отмена): обновляем тариф */
create or replace function public.svc_subscription_update(
  p_user uuid, p_interval public.billing_interval, p_status public.subscription_status, p_subscription text,
  p_period_end timestamptz, p_cancel_at_period_end boolean
) returns public.subscriptions
language plpgsql security definer set search_path = '' as $$
declare v public.subscriptions;
begin
  insert into public.subscriptions (user_id, plan, billing_interval, status, subscription_id, current_period_end, cancel_at_period_end, updated_at)
  values (p_user, 'pro', p_interval, p_status, p_subscription, p_period_end, coalesce(p_cancel_at_period_end, false), now())
  on conflict (user_id) do update set billing_interval = excluded.billing_interval, status = excluded.status,
    subscription_id = excluded.subscription_id, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()
  returning * into v;
  -- Доступ сохраняется до конца оплаченного периода; при просрочке оплаты — тоже, пока Stripe повторяет списание
  update public.profiles
     set plan = case when p_status in ('active', 'trialing', 'past_due') then 'pro'::public.plan_id else 'free' end
   where id = p_user;
  return v;
end $$;

create or replace function public.svc_subscription_by_id(p_subscription text) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.subscriptions where subscription_id = p_subscription
$$;

/** Модератор решает по возврату. При одобрении деньги уходят с баланса обратно на карту (через провайдера) */
create or replace function public.admin_refund_decide(p_refund uuid, p_decision text, p_resolution text default null)
returns public.refund_requests
language plpgsql security definer set search_path = '' as $$
declare v public.refund_requests;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v from public.refund_requests where id = p_refund for update;
  if v.id is null or v.status not in ('created', 'reviewing') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_decision = 'review' then
    update public.refund_requests set status = 'reviewing', reviewed_by = auth.uid() where id = v.id returning * into v;
  elsif p_decision = 'reject' then
    update public.refund_requests set status = 'rejected', resolution = p_resolution, reviewed_by = auth.uid()
     where id = v.id returning * into v;
  else
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  return v;
end $$;

/** Возврат проведён провайдером: списываем с баланса пользователя (topup_refund) */
create or replace function public.svc_refund_done(p_refund uuid, p_amount_cents bigint) returns public.refund_requests
language plpgsql security definer set search_path = '' as $$
declare
  v public.refund_requests;
  v_payment public.payments;
  v_tx uuid := gen_random_uuid();
begin
  select * into v from public.refund_requests where id = p_refund for update;
  if v.id is null then
    raise exception 'refund_not_found' using errcode = 'P0002';
  end if;
  if v.status = 'refunded' then
    return v;
  end if;
  if v.status not in ('created', 'reviewing') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  perform private.post(v_tx, 'topup_refund', 'available', v.user_id, null, -p_amount_cents, v.id::text, v.currency);
  perform private.post(v_tx, 'topup_refund', 'external', null, null, p_amount_cents, v.id::text, v.currency);
  if v.payment_id is not null then
    update public.payments
       set refunded_cents = refunded_cents + p_amount_cents,
           status = case when refunded_cents + p_amount_cents >= amount_cents then 'refunded'::public.payment_status else 'partially_refunded' end
     where id = v.payment_id;
  end if;
  update public.refund_requests set status = 'refunded', resolution = coalesce(resolution, 'refunded')
   where id = v.id returning * into v;
  return v;
end $$;

-- ---------- Квитанция по операции ----------
create or replace function public.receipt(p_tx uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
  v_task public.tasks;
  v_first public.ledger_entries;
begin
  if not exists (select 1 from public.ledger_entries where tx_id = p_tx and user_id = v_uid) and not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_first from public.ledger_entries where tx_id = p_tx order by id limit 1;
  select * into v_task from public.tasks where id = v_first.task_id;
  select jsonb_agg(jsonb_build_object('account', account, 'amount_cents', amount_cents, 'currency', currency, 'memo', memo) order by id)
    into v_rows from public.ledger_entries
   where tx_id = p_tx and (user_id = v_uid or private.is_staff() or account in ('platform_revenue', 'external'));
  return jsonb_build_object(
    'tx_id', p_tx, 'kind', v_first.kind, 'created_at', v_first.created_at, 'currency', v_first.currency,
    'task', case when v_task.id is not null then jsonb_build_object('id', v_task.id, 'title', v_task.title,
      'reward_cents', v_task.reward_cents, 'fee_cents', v_task.fee_cents, 'fee_bps', v_task.fee_bps) end,
    'entries', coalesce(v_rows, '[]')
  );
end $$;

-- ---------- Права ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.publish_task(uuid, text, text, public.task_category, public.result_format, public.task_deadline, public.task_kind, bigint, text, text[], double precision, double precision, integer, text, jsonb, public.money_currency, text, bigint, timestamptz)',
    'public.request_payout(public.payout_method, bigint, public.crypto_network, text, boolean)',
    'public.request_refund(uuid, uuid, public.refund_reason, bigint, text)',
    'public.admin_payout_decide(uuid, text, text)',
    'public.admin_refund_decide(uuid, text, text)',
    'public.receipt(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.svc_set_rates(jsonb, text)',
    'public.svc_event_begin(text, public.payment_provider, text, jsonb)',
    'public.svc_event_done(text)',
    'public.svc_payment_create(uuid, public.payment_kind, public.payment_provider, public.money_currency, bigint, text, jsonb, public.crypto_network, text, text)',
    'public.svc_payment_succeeded(text, text)',
    'public.svc_payment_failed(text, text, boolean)',
    'public.svc_customer_upsert(uuid, text)',
    'public.svc_connect_update(uuid, text, boolean, boolean)',
    'public.svc_connect_update_by_account(text, boolean, boolean)',
    'public.svc_payout_processing(uuid, text)',
    'public.svc_payout_paid(uuid)',
    'public.svc_payout_failed(uuid, text)',
    'public.svc_subscription_update(uuid, public.billing_interval, public.subscription_status, text, timestamptz, boolean)',
    'public.svc_subscription_by_id(text)',
    'public.svc_refund_done(uuid, bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on function private.post(uuid, public.ledger_kind, public.ledger_account, uuid, uuid, bigint, text, public.money_currency) from public;
revoke all on function private.payout_return(public.payouts, public.payout_status, text) from public;
revoke all on function private.payout_min_cents(public.payout_method), private.topup_min_cents(public.payment_provider) from public;


-- ---------- Выбор исполнителя: комиссия по шкале на новую цену, валюта задачи ----------
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

  v_new_fee := public.calc_fee(v_resp.price_cents, public.fee_bps_for_reward(v_resp.price_cents));
  v_delta := (v_resp.price_cents + v_new_fee) - (v.reward_cents + v.fee_cents);
  if v_delta > 0 then
    perform private.post(v_tx, 'task_adjust', 'available', v_uid, v.id, -v_delta, 'price_change', v.currency);
    perform private.post(v_tx, 'task_adjust', 'escrow', v_uid, v.id, v_delta, 'price_change', v.currency);
  elsif v_delta < 0 then
    perform private.post(v_tx, 'task_adjust', 'escrow', v_uid, v.id, v_delta, 'price_change', v.currency);
    perform private.post(v_tx, 'task_adjust', 'available', v_uid, v.id, -v_delta, 'price_change', v.currency);
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
         fee_bps = public.fee_bps_for_reward(v_resp.price_cents),
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


-- ---------- Приёмка: выплата в валюте задачи ----------
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

    perform private.post(v_tx, 'task_release', 'escrow', v.customer_id, v.id, -v_escrow, 'accept', v.currency);
    perform private.post(v_tx, 'task_release', 'available', v.executor_id, v.id, v.reward_cents, 'reward', v.currency);
    perform private.post(v_tx, 'task_release', 'platform_revenue', null, v.id, v.fee_cents, 'fee', v.currency);

    update public.submissions
       set status = 'accepted', checklist_result = p_checklist, review_comment = nullif(btrim(p_comment), ''),
           reviewed_at = now()
     where id = v_sub.id;
    update public.tasks set status = 'completed', completed_at = now() where id = v.id returning * into v;
    update public.profiles
       set completed_count = completed_count + 1,
           earned_cents = earned_cents + case when v.currency = 'USD' then v.reward_cents else 0 end
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
