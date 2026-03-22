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
    insert into public.user_profiles (user_id, token_balance)
    values (p_user_id, greatest(p_delta, 0))
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
  where user_id = p_user_id
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
  where user_id = p_user_id
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

create or replace function public.finalize_token_purchase_ledger(
  p_ledger_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_ledger%rowtype;
  v_new_balance integer;
begin
  select *
  into v_row
  from public.payment_ledger
  where id = p_ledger_id
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'ledger_not_found');
  end if;

  if v_row.payment_kind <> 'token_purchase' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_kind');
  end if;

  if v_row.status = 'succeeded' then
    select token_balance
    into v_new_balance
    from public.user_profiles
    where user_id = v_row.user_id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'new_balance', coalesce(v_new_balance, 0),
      'tokens_granted', coalesce(v_row.tokens, 0)
    );
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ledger_not_pending', 'status', v_row.status);
  end if;

  v_new_balance := public.increment_user_token_balance(v_row.user_id, coalesce(v_row.tokens, 0));

  update public.payment_ledger
  set status = 'succeeded',
      completed_at = now(),
      updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'new_balance', v_new_balance,
    'tokens_granted', coalesce(v_row.tokens, 0)
  );
end;
$$;

grant execute on function public.finalize_token_purchase_ledger(uuid) to service_role;

commit;
