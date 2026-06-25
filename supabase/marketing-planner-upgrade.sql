-- Planner upgrade: posts remember Alfred's seed idea, their secondary goal, and
-- where they came from (alfred suggestion vs manual). Run once in Supabase.

alter table public.content_posts
  add column if not exists seed_idea text,                       -- Alfred's one-line brief (for auto-draft + dedup)
  add column if not exists goal text,                            -- secondary goal: awareness | followers | inquiries | ...
  add column if not exists source text not null default 'manual'; -- manual | alfred
