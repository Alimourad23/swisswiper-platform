-- Instagram auto-publishing: adds publish tracking to content_posts.
-- Run once in Supabase → SQL Editor.
--
-- A post opts IN to auto-publishing per post (auto_publish, off by default —
-- nothing ever publishes without someone explicitly switching it on).
-- The daily publish cron picks up Instagram posts that are scheduled, opted-in
-- and due, publishes them via the Instagram API, and records the outcome here.

alter table public.content_posts
  add column if not exists auto_publish boolean not null default false,
  add column if not exists publish_at timestamptz,          -- reserved for per-post times (v2); v1 publishes at the daily cron time
  add column if not exists publish_status text,             -- null | publishing | published | failed
  add column if not exists published_at timestamptz,        -- when it actually went live
  add column if not exists external_post_id text,           -- Instagram media id
  add column if not exists external_permalink text,         -- public link to the live post
  add column if not exists publish_error text;              -- friendly error when publish_status = 'failed'

-- The cron scans a small slice: opted-in scheduled posts.
create index if not exists content_posts_autopub_idx
  on public.content_posts (status, scheduled_for)
  where auto_publish;
