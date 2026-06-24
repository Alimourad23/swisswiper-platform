-- Content schedule: planned social posts across channels, moving through a
-- pipeline (idea → draft → scheduled → published). Team-collaborative (internal
-- tool), so any signed-in teammate can read and edit. Run once in Supabase.

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  channel text not null default 'linkedin',
  status text not null default 'idea',        -- idea | draft | scheduled | published
  scheduled_for date,                          -- planned post date (nullable = backlog)
  format text default '',                      -- post | video | carousel | article | story | reel
  body text not null default '',               -- caption / draft
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_posts_date_idx on public.content_posts (scheduled_for);

alter table public.content_posts enable row level security;

-- Internal team tool: any authenticated user can read/edit; inserts stamp the author.
drop policy if exists "content read" on public.content_posts;
create policy "content read" on public.content_posts for select to authenticated using (true);

drop policy if exists "content insert" on public.content_posts;
create policy "content insert" on public.content_posts for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "content update" on public.content_posts;
create policy "content update" on public.content_posts for update to authenticated using (true) with check (true);

drop policy if exists "content delete" on public.content_posts;
create policy "content delete" on public.content_posts for delete to authenticated using (true);
