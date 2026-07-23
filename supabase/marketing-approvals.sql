-- Approval-before-publish for content posts.
-- A post moves: none (draft) → pending (submitted) → approved, or → changes
-- (founder asked for edits). Publishing (manual "Publish now" and the daily
-- auto-publish cron) only proceeds once a post is 'approved'. Founders can
-- approve; anyone with Edit on Marketing can submit.
-- Run once. Safe to re-run.

alter table public.content_posts add column if not exists approval_status text not null default 'none';
alter table public.content_posts add column if not exists submitted_by uuid;
alter table public.content_posts add column if not exists submitted_at timestamptz;
alter table public.content_posts add column if not exists approved_by  uuid;
alter table public.content_posts add column if not exists approved_at  timestamptz;
alter table public.content_posts add column if not exists review_note  text;

-- Fast lookups for the cron ("approved & due") and the "awaiting approval" view.
create index if not exists content_posts_approval_idx on public.content_posts (approval_status);
