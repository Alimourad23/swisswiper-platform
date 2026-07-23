-- Admin / control panel — foundation schema.
-- Roles (founder/admin/member/viewer), teams, a shared access policy, org
-- settings, and an audit log. All admin writes go through the service-role
-- client after a server-side role check, so RLS here is read-only for the app.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Extend profiles with the fields the People page needs.
alter table public.profiles add column if not exists full_name   text;
alter table public.profiles add column if not exists email       text;
alter table public.profiles add column if not exists status      text not null default 'active';   -- active | deactivated
alter table public.profiles add column if not exists team_id     uuid;
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists updated_at   timestamptz not null default now();

-- Make sure role has a sane default (existing rows keep their value).
alter table public.profiles alter column role set default 'member';

-- 2. Teams.
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- 3. Single-row config: access policy (role → allowed modules) and org settings.
create table if not exists public.admin_config (
  id         text primary key,          -- 'access' | 'org'
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- 4. Audit log — who did what.
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  actor_name text,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- 5. RLS — readable by any signed-in teammate; all writes happen via the
--    service-role client (which bypasses RLS) after a role check in the action.
alter table public.teams        enable row level security;
alter table public.admin_config enable row level security;
alter table public.audit_log    enable row level security;

drop policy if exists "teams read"        on public.teams;
drop policy if exists "admin_config read" on public.admin_config;
drop policy if exists "audit read"        on public.audit_log;

create policy "teams read"        on public.teams        for select to authenticated using (true);
create policy "admin_config read" on public.admin_config for select to authenticated using (true);
create policy "audit read"        on public.audit_log    for select to authenticated using (true);
