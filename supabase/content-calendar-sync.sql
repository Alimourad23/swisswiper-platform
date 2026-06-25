-- Marketing content → Google Calendar sync.
-- Remembers which Google Calendar event IDs belong to each post, so that
-- rescheduling moves the events (delete + recreate) instead of duplicating them,
-- and deleting a post can clean up its calendar events.

alter table public.content_posts
  add column if not exists gcal_event_ids text[] not null default '{}'::text[];
