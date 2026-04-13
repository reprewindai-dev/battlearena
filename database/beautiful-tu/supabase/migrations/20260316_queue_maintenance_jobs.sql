-- Queue maintenance automation using pg_cron.
-- Schedules periodic cleanup of expired matchmaking rows.

begin;

create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'cleanup_expired_matchmaking_queue'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'cleanup_expired_matchmaking_queue',
    '*/1 * * * *',
    $job$select public.cleanup_expired_queue();$job$
  );
end $$;

commit;
