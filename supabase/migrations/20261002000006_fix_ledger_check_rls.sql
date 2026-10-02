-- Исправление: проверка «сумма транзакции = 0» выполнялась при коммите с правами вызывающего.
-- Под ролью authenticated RLS скрывает чужие проводки (счёт исполнителя, выручку платформы),
-- поэтому приёмка работы ошибочно падала с ledger_unbalanced. Проверка должна видеть весь журнал.
create or replace function private.assert_tx_balanced() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sum bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_sum from public.ledger_entries where tx_id = new.tx_id;
  if v_sum <> 0 then
    raise exception 'ledger_unbalanced: tx % sums to %', new.tx_id, v_sum using errcode = 'P0001';
  end if;
  return null;
end $$;

revoke all on function private.assert_tx_balanced() from public;
