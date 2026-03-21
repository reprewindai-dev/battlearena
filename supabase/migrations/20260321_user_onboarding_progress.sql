begin;

create table if not exists public.user_onboarding_progress (
  user_id uuid primary key references public.users(id) on delete cascade,
  welcome_notification_sent_at timestamptz null,
  dismissed_at timestamptz null,
  completed_at timestamptz null,
  last_viewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_onboarding_progress_dismissed_idx
  on public.user_onboarding_progress (dismissed_at);

create index if not exists user_onboarding_progress_completed_idx
  on public.user_onboarding_progress (completed_at);

alter table public.user_onboarding_progress enable row level security;

drop policy if exists "Users can view own onboarding progress" on public.user_onboarding_progress;
create policy "Users can view own onboarding progress"
  on public.user_onboarding_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own onboarding progress" on public.user_onboarding_progress;
create policy "Users can upsert own onboarding progress"
  on public.user_onboarding_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own onboarding progress" on public.user_onboarding_progress;
create policy "Users can update own onboarding progress"
  on public.user_onboarding_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
