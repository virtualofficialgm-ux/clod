-- Parri · новые значения перечислений для денег (отдельной миграцией, см. 0009)
alter type public.ledger_kind add value if not exists 'tip';
alter type public.ledger_kind add value if not exists 'payout_hold';
alter type public.ledger_kind add value if not exists 'payout_paid';
alter type public.ledger_kind add value if not exists 'payout_return';
