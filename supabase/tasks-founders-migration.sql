-- ============================================================================
-- Round 2 — Tasks: founders-only visibility
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run.
-- ============================================================================

-- ── profiles.role ────────────────────────────────────────────────────────────
-- Each team member is a 'member' by default. 'founder' unlocks founders-only
-- tasks. Adding the column backfills existing rows with 'member'.
alter table public.profiles
  add column if not exists role text not null default 'member';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('member','founder'));

-- Promote the founders. Re-run any time to change roles. (Only affects people
-- who have already signed in at least once, so their profile row exists.)
update public.profiles set role = 'founder'
  where email in ('ali@swisswiper.com', 'max@swisswiper.com');

-- ── tasks.visibility — add 'founders' ────────────────────────────────────────
-- Drop + recreate the check constraint to allow the new value.
alter table public.tasks drop constraint if exists tasks_visibility_check;
alter table public.tasks
  add constraint tasks_visibility_check check (visibility in ('team','personal','founders'));

-- ── RLS — founders-only tasks are visible/editable only by founders ──────────
-- The founders branch is gated by an EXISTS against profiles. profiles' own
-- SELECT policy is "true" for any signed-in user, so this is NOT recursive.
-- team/personal tasks keep their existing rules; founders tasks are walled off
-- to role='founder' (even if a member was added as creator/assignee).

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    (
      visibility <> 'founders' and (
        visibility = 'team'
        or created_by = auth.uid()
        or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
      )
    )
    or (
      visibility = 'founders'
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'founder')
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated using (
    (
      visibility <> 'founders' and (
        visibility = 'team'
        or created_by = auth.uid()
        or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
      )
    )
    or (
      visibility = 'founders'
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'founder')
    )
  ) with check (
    (
      visibility <> 'founders' and (
        visibility = 'team'
        or created_by = auth.uid()
        or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
      )
    )
    or (
      visibility = 'founders'
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'founder')
    )
  );
