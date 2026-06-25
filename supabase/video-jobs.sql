-- Veo video generation jobs (async): a row per video request, polled until the
-- clip is ready and stored in content_media. Run once in Supabase.

create table if not exists public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.content_posts (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'pending',   -- pending | done | error
  operation text,                           -- Veo operation name to poll
  model text,
  prompt text,
  seconds int not null default 8,
  cost_usd numeric not null default 0,
  media_id uuid references public.content_media (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists video_jobs_post_idx on public.video_jobs (post_id);

alter table public.video_jobs enable row level security;

drop policy if exists "video_jobs read" on public.video_jobs;
create policy "video_jobs read" on public.video_jobs for select to authenticated using (true);

drop policy if exists "video_jobs insert" on public.video_jobs;
create policy "video_jobs insert" on public.video_jobs for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "video_jobs update" on public.video_jobs;
create policy "video_jobs update" on public.video_jobs for update to authenticated using (true) with check (true);
