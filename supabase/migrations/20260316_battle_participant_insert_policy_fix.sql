-- Allow authenticated users to insert their own participant row during join flow.
-- Existence checks against battles can fail under RLS before a user is a participant.

begin;

drop policy if exists battle_participants_insert_self_only on public.battle_participants;
create policy battle_participants_insert_self_only
  on public.battle_participants
  for insert
  to authenticated
  with check (user_id = auth.uid());

commit;
