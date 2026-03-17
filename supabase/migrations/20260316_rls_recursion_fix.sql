-- Fix RLS recursion between battles and battle_participants policies.

begin;

drop policy if exists battles_select_participant_or_creator on public.battles;
create policy battles_select_participant_or_creator
  on public.battles
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or participant_1_id = auth.uid()
    or participant_2_id = auth.uid()
  );

drop policy if exists battle_participants_select_participants_only on public.battle_participants;
create policy battle_participants_select_participants_only
  on public.battle_participants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.battles b
      where b.id = battle_participants.battle_id
        and (
          b.created_by = auth.uid()
          or b.participant_1_id = auth.uid()
          or b.participant_2_id = auth.uid()
        )
    )
  );

commit;
