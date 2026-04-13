begin;

create or replace function public.spend_user_token_balance(
  p_user_id uuid,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  select token_balance
  into v_current_balance
  from public.user_profiles
  where id = p_user_id
  for update;

  v_current_balance := coalesce(v_current_balance, 0);

  if v_current_balance < p_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'current_balance', v_current_balance
    );
  end if;

  update public.user_profiles
  set token_balance = token_balance - p_amount,
      updated_at = now()
  where id = p_user_id
  returning token_balance into v_new_balance;

  return jsonb_build_object(
    'ok', true,
    'previous_balance', v_current_balance,
    'new_balance', coalesce(v_new_balance, 0),
    'amount_spent', p_amount
  );
end;
$$;

grant execute on function public.spend_user_token_balance(uuid, integer) to authenticated;
grant execute on function public.spend_user_token_balance(uuid, integer) to service_role;

commit;
