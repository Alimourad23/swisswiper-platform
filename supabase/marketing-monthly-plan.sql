-- Monthly content planning — Alfred suggests a plan when a month is looking thin.
-- One row per target month, holding the suggested posts until they're added to
-- the pipeline (applied) or dismissed. Run once in Supabase → SQL Editor.

create table if not exists public.marketing_month_plans (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,                       -- 'YYYY-MM' the plan targets
  status text not null default 'suggested',         -- suggested | applied | dismissed
  suggestions jsonb not null default '[]'::jsonb,    -- [{channel,title,idea,day}]
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_month_plans enable row level security;

-- Internal team tool: any signed-in teammate can read/insert/update; the cron
-- writes with the service-role key (bypasses RLS).
drop policy if exists "month_plans read" on public.marketing_month_plans;
create policy "month_plans read" on public.marketing_month_plans for select to authenticated using (true);

drop policy if exists "month_plans insert" on public.marketing_month_plans;
create policy "month_plans insert" on public.marketing_month_plans for insert to authenticated with check (true);

drop policy if exists "month_plans update" on public.marketing_month_plans;
create policy "month_plans update" on public.marketing_month_plans for update to authenticated using (true) with check (true);
