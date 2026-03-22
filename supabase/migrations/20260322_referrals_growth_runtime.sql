create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.users(id) on delete cascade,
  code text not null unique,
  label text null,
  clicks integer not null default 0,
  signups integer not null default 0,
  activations integer not null default 0,
  last_clicked_at timestamptz null,
  last_signup_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_referrals (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.referral_invites(id) on delete cascade,
  inviter_user_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid not null unique references public.users(id) on delete cascade,
  status text not null default 'signed_up' check (status in ('signed_up', 'activated')),
  activation_event text null,
  activated_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists referral_invites_inviter_idx on public.referral_invites(inviter_user_id, created_at desc);
create index if not exists referral_invites_code_idx on public.referral_invites(code);
create index if not exists user_referrals_inviter_idx on public.user_referrals(inviter_user_id, created_at desc);
create index if not exists user_referrals_referred_idx on public.user_referrals(referred_user_id);
create index if not exists user_referrals_status_idx on public.user_referrals(status);

alter table public.referral_invites enable row level security;
alter table public.user_referrals enable row level security;

drop policy if exists "Users can view own referral invites" on public.referral_invites;
create policy "Users can view own referral invites"
  on public.referral_invites
  for select
  using (auth.uid() = inviter_user_id);

drop policy if exists "Users can create own referral invites" on public.referral_invites;
create policy "Users can create own referral invites"
  on public.referral_invites
  for insert
  with check (auth.uid() = inviter_user_id);

drop policy if exists "Users can update own referral invites" on public.referral_invites;
create policy "Users can update own referral invites"
  on public.referral_invites
  for update
  using (auth.uid() = inviter_user_id)
  with check (auth.uid() = inviter_user_id);

drop policy if exists "Users can view referral relationships they belong to" on public.user_referrals;
create policy "Users can view referral relationships they belong to"
  on public.user_referrals
  for select
  using (auth.uid() = inviter_user_id or auth.uid() = referred_user_id);
