-- AI spend tracking + monthly cap for the marketing creative tools (Nano Banana
-- images, Veo video). Run once in Supabase → SQL Editor.

-- Every generation logs an estimated cost so we can show usage and enforce a cap.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,                       -- image | video
  model text,
  units numeric not null default 1,         -- images count, or video seconds
  cost_usd numeric not null default 0,      -- estimated
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage read" on public.ai_usage;
create policy "ai_usage read" on public.ai_usage for select to authenticated using (true);

drop policy if exists "ai_usage insert" on public.ai_usage;
create policy "ai_usage insert" on public.ai_usage for insert to authenticated with check (user_id = auth.uid());

-- Singleton budget row. Founders can change the cap; everyone can read it.
create table if not exists public.ai_budget (
  id text primary key default 'budget',
  monthly_cap_usd numeric not null default 50,
  updated_at timestamptz not null default now()
);

insert into public.ai_budget (id) values ('budget') on conflict (id) do nothing;

alter table public.ai_budget enable row level security;

drop policy if exists "ai_budget read" on public.ai_budget;
create policy "ai_budget read" on public.ai_budget for select to authenticated using (true);

drop policy if exists "ai_budget write" on public.ai_budget;
create policy "ai_budget write" on public.ai_budget for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'founder'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'founder'));
