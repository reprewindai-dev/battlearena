-- Normalize search_path for critical functions to avoid role-mutable search_path issues.

-- RBAC helpers
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
begin
  if coalesce(public.jwt_role(), '') = role_name then
    return true;
  end if;
  if to_regclass('public.role_assignments') is null or to_regclass('public.roles') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    where ra.user_id = auth.uid()
      and r.name = role_name
  );
end;
$$;

-- Economy
CREATE OR REPLACE FUNCTION public.create_economy_transaction(
  p_idempotency_key text,
  p_currency public.ledger_currency,
  p_amount numeric,
  p_memo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_tx_id uuid;
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  insert into public.idempotency_keys(key) values (p_idempotency_key);
  insert into public.economy_transactions(idempotency_key, actor_user_id, memo, status, posted_at)
  values (p_idempotency_key, auth.uid(), p_memo, 'posted', now())
  returning id into v_tx_id;
  insert into public.economy_ledger_entries(tx_id, user_id, currency, entry_type, amount)
  values (v_tx_id, auth.uid(), p_currency, 'credit', p_amount);
  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'economy_transaction', 'economy_transaction', v_tx_id, jsonb_build_object('currency', p_currency, 'amount', p_amount));
  return jsonb_build_object('ok', true, 'tx_id', v_tx_id);
end;
$$;

-- Moderation
CREATE OR REPLACE FUNCTION public.moderation_take_action(
  p_idempotency_key text,
  p_case_id uuid,
  p_action_type text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_action_id uuid;
begin
  if not (public.has_role('admin') or public.has_role('mod')) then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  insert into public.idempotency_keys(key) values (p_idempotency_key);
  insert into public.moderation_actions(case_id, actor_user_id, action_type, payload)
  values (p_case_id, auth.uid(), p_action_type, p_payload)
  returning id into v_action_id;
  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'moderation_action', 'moderation_case', p_case_id, jsonb_build_object('action_id', v_action_id, 'type', p_action_type));
  return jsonb_build_object('ok', true, 'action_id', v_action_id);
end;
$$;

-- Battles
CREATE OR REPLACE FUNCTION public.record_battle_result(
  p_idempotency_key text,
  p_battle_id uuid,
  p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  insert into public.idempotency_keys(key) values (p_idempotency_key);
  update public.battles
  set status = 'complete', result = p_result, ended_at = now(), updated_at = now()
  where id = p_battle_id;
  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'record_battle_result', 'battle', p_battle_id, jsonb_build_object('result', p_result));
  return jsonb_build_object('ok', true);
end;
$$;

-- Ensure battle_recordings carries session_id for compatibility
ALTER TABLE public.battle_recordings
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.battle_sessions(id) ON DELETE CASCADE;

-- Cleanup RPC
DROP FUNCTION IF EXISTS public.list_stale_recordings(timestamptz, timestamptz, int);
CREATE OR REPLACE FUNCTION public.list_stale_recordings(
  cutoff timestamptz,
  after_created_at timestamptz default null,
  batch_size int default 200
) RETURNS TABLE(
  id uuid,
  session_id uuid,
  user_id uuid,
  round_number int,
  file_url text,
  duration_seconds int,
  file_size_bytes int,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select
    id,
    session_id,
    user_id,
    round_number,
    file_url,
    duration_seconds,
    file_size_bytes,
    created_at
  from public.battle_recordings
  where created_at < cutoff
    and (after_created_at is null or created_at > after_created_at)
  order by created_at asc
  limit batch_size;
$$;
