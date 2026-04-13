alter table public.battles
  add column if not exists voting_opened_at timestamptz,
  add column if not exists voting_closes_at timestamptz;
