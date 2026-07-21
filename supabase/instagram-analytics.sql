-- Instagram analytics: one snapshot row per day (followers, post count,
-- engagement totals), written whenever someone views the Instagram analytics
-- page. Over time this builds the follower-growth history the live API
-- doesn't provide. Run once in Supabase → SQL Editor.

create table if not exists public.ig_daily_snapshots (
  snap_date date primary key,
  followers integer not null default 0,
  media_count integer not null default 0,
  total_likes integer not null default 0,
  total_comments integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ig_daily_snapshots enable row level security;

-- Internal team tool: any signed-in teammate reads and records snapshots.
drop policy if exists "ig snapshots read" on public.ig_daily_snapshots;
create policy "ig snapshots read" on public.ig_daily_snapshots
  for select to authenticated using (true);

drop policy if exists "ig snapshots insert" on public.ig_daily_snapshots;
create policy "ig snapshots insert" on public.ig_daily_snapshots
  for insert to authenticated with check (true);

drop policy if exists "ig snapshots update" on public.ig_daily_snapshots;
create policy "ig snapshots update" on public.ig_daily_snapshots
  for update to authenticated using (true) with check (true);
