-- Richer change log: capture the module, the thing changed, and before → after.
-- Also allow any signed-in teammate to insert their OWN audit rows, so actions
-- across the app (not just admin ones via the service role) can be recorded.
-- Run once. Safe to re-run.

alter table public.audit_log add column if not exists module text;
alter table public.audit_log add column if not exists target text;
alter table public.audit_log add column if not exists before text;
alter table public.audit_log add column if not exists after  text;

drop policy if exists "audit insert" on public.audit_log;
create policy "audit insert" on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid());
