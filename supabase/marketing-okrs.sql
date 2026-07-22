-- Marketing OKRs — a single shared row (id = 'okr') holding the objective and
-- the company + per-channel key results as JSON. Run once in the Supabase SQL editor.

create table if not exists public.marketing_okrs (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.marketing_okrs enable row level security;

-- Any signed-in user can read and write the shared OKRs (same model as the plan).
drop policy if exists "okrs read"  on public.marketing_okrs;
drop policy if exists "okrs write" on public.marketing_okrs;

create policy "okrs read"  on public.marketing_okrs for select to authenticated using (true);
create policy "okrs write" on public.marketing_okrs for all    to authenticated using (true) with check (true);
