-- ============================================================================
-- Phase 3.5 — Tasks module + notification service
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses "if not exists" / "drop policy if exists".
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per team member, mirrored from their Google identity on sign-in.
-- Powers the assignee dropdown and @mentions.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  notes         text not null default '',
  status        text not null default 'todo'   check (status in ('todo','in_progress','done')),
  priority      text not null default 'normal' check (priority in ('low','normal','high')),
  due_at        timestamptz,
  visibility    text not null default 'team'   check (visibility in ('team','personal')),
  tags          text[] not null default '{}',
  created_by    uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  completed_at  timestamptz
);

alter table public.tasks enable row level security;

-- ── task_assignees ───────────────────────────────────────────────────────────
-- Defined before the tasks policies, but tasks' SELECT subqueries this table —
-- so this table's SELECT is intentionally "true" (readable by any signed-in
-- user) to avoid recursive RLS between the two tables.
create table if not exists public.task_assignees (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

alter table public.task_assignees enable row level security;

drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees
  for select to authenticated using (true);

drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees
  for insert to authenticated with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and (t.created_by = auth.uid() or t.visibility = 'team')
    )
  );

drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees
  for delete to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and (t.created_by = auth.uid() or t.visibility = 'team')
    )
  );

-- tasks policies (now that task_assignees exists)
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    visibility = 'team'
    or created_by = auth.uid()
    or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (created_by = auth.uid());

-- Team tasks: any signed-in user may edit. Personal tasks: creator or assignee.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated using (
    visibility = 'team'
    or created_by = auth.uid()
    or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
  ) with check (
    visibility = 'team'
    or created_by = auth.uid()
    or auth.uid() in (select user_id from public.task_assignees where task_id = tasks.id)
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (created_by = auth.uid());

-- ── notifications ─────────────────────────────────────────────────────────────
-- A user may only read/update their OWN notifications. There is deliberately
-- NO insert policy: rows are created only by the server (service-role key) via
-- the notification service + the reminders cron, so notifications can't be
-- forged from the browser.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete cascade,
  type        text not null check (type in ('assigned','mentioned','comment','status','due','overdue')),
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Let the browser subscribe to live changes. If a table is already in the
-- publication this errors harmlessly — ignore "already member" messages.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignees;
alter publication supabase_realtime add table public.notifications;
