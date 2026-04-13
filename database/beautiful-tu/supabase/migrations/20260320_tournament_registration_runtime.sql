begin;

create or replace function public.register_tournament_participant_runtime(
  p_tournament_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_existing public.tournament_participants%rowtype;
  v_participant public.tournament_participants%rowtype;
  v_participant_count bigint;
  v_spend_result jsonb;
  v_current_balance integer;
begin
  select *
  into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if v_tournament.id is null then
    return jsonb_build_object('ok', false, 'error', 'Tournament not found', 'status_code', 404);
  end if;

  if v_tournament.status <> 'registration' then
    return jsonb_build_object('ok', false, 'error', 'Registration is closed', 'status_code', 400);
  end if;

  if v_tournament.registration_closes is not null and v_tournament.registration_closes < now() then
    return jsonb_build_object('ok', false, 'error', 'Registration deadline passed', 'status_code', 400);
  end if;

  select *
  into v_existing
  from public.tournament_participants
  where tournament_id = p_tournament_id
    and user_id = p_user_id
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('ok', false, 'error', 'Already registered', 'status_code', 409);
  end if;

  select count(*)
  into v_participant_count
  from public.tournament_participants
  where tournament_id = p_tournament_id;

  if v_participant_count >= coalesce(v_tournament.max_participants, 0) then
    return jsonb_build_object('ok', false, 'error', 'Tournament is full', 'status_code', 400);
  end if;

  if coalesce(v_tournament.entry_fee_tokens, 0) > 0 then
    v_spend_result := public.spend_user_token_balance(p_user_id, v_tournament.entry_fee_tokens);

    if coalesce((v_spend_result->>'ok')::boolean, false) is not true then
      if v_spend_result->>'error' = 'insufficient_balance' then
        v_current_balance := coalesce((v_spend_result->>'current_balance')::integer, 0);
        return jsonb_build_object(
          'ok', false,
          'error', 'Insufficient tokens',
          'status_code', 400,
          'current_balance', v_current_balance
        );
      end if;

      return jsonb_build_object(
        'ok', false,
        'error', coalesce(v_spend_result->>'error', 'token_spend_failed'),
        'status_code', 409
      );
    end if;

    insert into public.token_transactions (
      user_id,
      recipient_id,
      tokens_spent,
      points_earned,
      platform_share,
      transaction_type,
      reference_id
    )
    values (
      p_user_id,
      v_tournament.created_by,
      v_tournament.entry_fee_tokens,
      0,
      0,
      'tournament_entry_fee',
      p_tournament_id
    );
  end if;

  insert into public.tournament_participants (
    tournament_id,
    user_id,
    status
  )
  values (
    p_tournament_id,
    p_user_id,
    'registered'
  )
  returning *
  into v_participant;

  return jsonb_build_object(
    'ok', true,
    'participant', row_to_json(v_participant),
    'entry_fee_tokens', coalesce(v_tournament.entry_fee_tokens, 0),
    'tournament_name', v_tournament.name
  );
end;
$$;

grant execute on function public.register_tournament_participant_runtime(uuid, uuid) to authenticated;
grant execute on function public.register_tournament_participant_runtime(uuid, uuid) to service_role;

commit;
