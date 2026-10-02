-- Parri · новые значения перечислений для платежей (отдельной миграцией: значение enum
-- можно использовать только после коммита той транзакции, в которой его добавили).
-- hold — деньги пользователя, зарезервированные под вывод или возврат до подтверждения Stripe.
alter type public.ledger_account add value if not exists 'hold';
alter type public.ledger_kind add value if not exists 'topup_refund';
