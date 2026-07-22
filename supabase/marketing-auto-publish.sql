-- Ensures the auto-publish flag exists on content_posts. The daily publish cron
-- only posts Instagram items where auto_publish = true. Safe to re-run.

alter table public.content_posts
  add column if not exists auto_publish boolean not null default false;
