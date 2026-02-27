-- Harden handle_new_user to avoid unexpected failures when tables/roles are missing
set search_path = public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- profiles bootstrap (guard table exists)
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
  ) then
    insert into public.profiles(user_id, handle, display_name)
    values (new.id, null, null)
    on conflict (user_id) do nothing;
  end if;

  -- ratings bootstrap (guard table exists)
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ratings'
  ) then
    insert into public.ratings(user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  -- base role assignment (guard roles table/row exists)
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'roles'
  ) then
    insert into public.role_assignments(user_id, role_id)
    select new.id, r.id
    from public.roles r
    where r.name = 'user'
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
