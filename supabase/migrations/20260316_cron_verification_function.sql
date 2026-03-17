-- Helper function for API-safe verification of pg_cron maintenance job presence.

begin;

create or replace function public.has_cleanup_expired_queue_cron_job()
returns boolean
language sql
security definer
set search_path = public, cron
as $$
  select exists (
    select 1
    from cron.job
    where jobname = 'cleanup_expired_matchmaking_queue'
      and active = true
  );
$$;

revoke all on function public.has_cleanup_expired_queue_cron_job() from public;
grant execute on function public.has_cleanup_expired_queue_cron_job() to authenticated, service_role;

commit;
