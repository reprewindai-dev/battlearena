-- Ranked matchmaking: rating snapshot + rating-window matching

begin;

alter table public.matchmaking_queue
  add column if not exists rating_at_enqueue numeric;

-- Ensure only one active queued/searching entry per user+mode.
create unique index if not exists matchmaking_queue_one_active_queued_per_user_mode
  on public.matchmaking_queue (user_id, mode)
  where status = 'queued';

-- Helpful index for ranked matching scans.
create index if not exists matchmaking_queue_ranked_search_idx
  on public.matchmaking_queue (mode, status, created_at, rating_at_enqueue);

commit;
