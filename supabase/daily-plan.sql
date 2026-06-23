-- Daily plan: each person's committed tasks for a given day, with a time
-- estimate. Per-user (the same team task can be on several people's days), so
-- it's its own table keyed by (user, task, date). Run once in Supabase.

create table if not exists public.daily_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  plan_date date not null,
  estimate_min integer not null default 30,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, plan_date)
);

create index if not exists daily_plan_user_date_idx
  on public.daily_plan (user_id, plan_date);

alter table public.daily_plan enable row level security;

-- Each person owns only their own plan rows.
drop policy if exists "own daily plan" on public.daily_plan;
create policy "own daily plan" on public.daily_plan
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
