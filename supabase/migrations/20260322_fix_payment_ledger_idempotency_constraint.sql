begin;

drop index if exists public.idx_payment_ledger_idempotency_key;

create unique index if not exists idx_payment_ledger_idempotency_key
  on public.payment_ledger (idempotency_key);

commit;
