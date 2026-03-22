begin;

create or replace function public.increment_user_token_balance(
  p_user_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
  v_display_name text;
begin
  if p_delta = 0 then
    select token_balance into v_new_balance
    from public.user_profiles
    where user_id = p_user_id;

    return coalesce(v_new_balance, 0);
  end if;

  update public.user_profiles
  set token_balance = coalesce(token_balance, 0) + p_delta,
      updated_at = now()
  where user_id = p_user_id
  returning token_balance into v_new_balance;

  if not found then
    select username
    into v_display_name
    from public.users
    where id = p_user_id;

    insert into public.user_profiles (user_id, display_name, token_balance)
    values (p_user_id, coalesce(nullif(v_display_name, ''), 'user'), greatest(p_delta, 0))
    on conflict (user_id) do update
      set token_balance = coalesce(public.user_profiles.token_balance, 0) + p_delta,
          updated_at = now()
    returning token_balance into v_new_balance;
  end if;

  return coalesce(v_new_balance, 0);
end;
$$;

grant execute on function public.increment_user_token_balance(uuid, integer) to authenticated;
grant execute on function public.increment_user_token_balance(uuid, integer) to service_role;

commit;
