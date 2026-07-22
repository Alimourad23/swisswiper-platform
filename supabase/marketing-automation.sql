-- Automation graduation policy — a single shared row (id = 'policy') holding,
-- per comment/DM category, whether Alfred's reply is approval-first or auto.
-- Run once in the Supabase SQL editor.

create table if not exists public.marketing_automation (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.marketing_automation enable row level security;

drop policy if exists "automation read"  on public.marketing_automation;
drop policy if exists "automation write" on public.marketing_automation;

create policy "automation read"  on public.marketing_automation for select to authenticated using (true);
create policy "automation write" on public.marketing_automation for all    to authenticated using (true) with check (true);
