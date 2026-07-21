-- Instagram OAuth token storage (single row) — written by the "Reconnect
-- Instagram" flow, read server-side only. Run once in Supabase → SQL Editor.
--
-- RLS is enabled with NO policies: browser/authenticated clients can never
-- read the token; only the server's service-role key can (it bypasses RLS).

create table if not exists public.instagram_tokens (
  id integer primary key default 1 check (id = 1),
  access_token text not null,
  expires_at timestamptz,
  connected_username text,
  updated_at timestamptz not null default now()
);

alter table public.instagram_tokens enable row level security;
