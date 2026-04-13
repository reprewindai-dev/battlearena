-- Arena Community Foundation (v2)
-- Align roles with Supabase Auth JWT claims and bootstrap core rows on signup.

begin;

-- Read a role from the JWT app_metadata (preferred) or user_metadata.
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role')
  );
$$;

-- Extend has_role to support JWT claims while keeping role tables.
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select coalesce(public.jwt_role(), '') = role_name
  or exists (
    select 1
    from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    where ra.user_id = auth.uid()
      and r.name = role_name
  );
$$;

-- Bootstrap a profile + rating row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id, handle, display_name)
  values (new.id, null, null)
  on conflict (user_id) do nothing;

  insert into public.ratings(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- Assign base role in tables (keeps compatibility even if JWT roles are used later).
  insert into public.role_assignments(user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.name = 'user'
  on conflict (user_id, role_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

commit;
