-- The living marketing plan — a single shared document (one row) the team edits.
-- Run once in Supabase.

create table if not exists public.marketing_plan (
  id text primary key default 'plan',
  goals text not null default '',
  audience text not null default '',
  positioning text not null default '',
  pillars text not null default '',
  cadence text not null default '',
  budget text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.marketing_plan enable row level security;

drop policy if exists "plan read" on public.marketing_plan;
create policy "plan read" on public.marketing_plan for select to authenticated using (true);

drop policy if exists "plan insert" on public.marketing_plan;
create policy "plan insert" on public.marketing_plan for insert to authenticated with check (true);

drop policy if exists "plan update" on public.marketing_plan;
create policy "plan update" on public.marketing_plan for update to authenticated using (true) with check (true);
