-- Per-person and per-team module access (Hidden / View / Edit).
-- Each is a jsonb map of { moduleKey: "hidden" | "view" | "edit" } for the
-- gated modules (Marketing, Sales, …). Baseline modules (Overview, Emails,
-- Calendar, Tasks) are always available and aren't stored here. Founders are
-- super-admins and bypass this entirely. Run once. Safe to re-run.

alter table public.profiles add column if not exists access jsonb not null default '{}'::jsonb;
alter table public.teams    add column if not exists access jsonb not null default '{}'::jsonb;
