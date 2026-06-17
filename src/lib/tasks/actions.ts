"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { displayName } from "@/lib/tasks/format";
import type {
  Profile,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from "@/lib/tasks/types";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const actorName = meta.full_name ?? meta.name ?? user.email ?? "A teammate";
  return { supabase, userId: user.id, actorName };
}

function refresh() {
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

function dueSuffix(dueAt: string | null): string {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "";
  return ` — due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/* ── Create ─────────────────────────────────────────────────────────────── */

export async function createTask(input: {
  title: string;
  assigneeIds?: string[];
  dueAt?: string | null;
  priority?: TaskPriority;
  visibility?: TaskVisibility;
  notes?: string;
  tags?: string[];
}): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "A title is required." };

  const { data, error } = await c.supabase
    .from("tasks")
    .insert({
      title,
      notes: input.notes?.trim() ?? "",
      priority: input.priority ?? "normal",
      visibility: input.visibility ?? "team",
      due_at: input.dueAt ?? null,
      tags: input.tags ?? [],
      created_by: c.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create task." };

  const taskId = data.id as string;
  const assignees = (input.assigneeIds ?? []).filter(Boolean);
  if (assignees.length) {
    await c.supabase
      .from("task_assignees")
      .insert(assignees.map((user_id) => ({ task_id: taskId, user_id })));
    await Promise.all(
      assignees.map((uid) =>
        notify({
          userId: uid,
          actorId: c.userId,
          type: "assigned",
          taskId,
          message: `${c.actorName} assigned you "${title}"${dueSuffix(input.dueAt ?? null)}.`,
        }),
      ),
    );
  }

  // @mentions in the initial notes.
  if (input.notes) await notifyMentions(input.notes, "", taskId, title, c);

  refresh();
  return { ok: true, id: taskId };
}

/* ── Update fields ──────────────────────────────────────────────────────── */

export async function updateTask(
  id: string,
  fields: {
    title?: string;
    notes?: string;
    priority?: TaskPriority;
    visibility?: TaskVisibility;
    dueAt?: string | null;
    tags?: string[];
  },
  profiles?: Profile[],
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };

  // Read the current notes + title so we can diff @mentions and avoid re-pinging.
  const { data: existing } = await c.supabase
    .from("tasks")
    .select("notes, title")
    .eq("id", id)
    .maybeSingle();
  const prevNotes = (existing as { notes?: string } | null)?.notes ?? "";
  const title = fields.title?.trim() ?? (existing as { title?: string } | null)?.title ?? "";

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) patch.title = title;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.priority !== undefined) patch.priority = fields.priority;
  if (fields.visibility !== undefined) patch.visibility = fields.visibility;
  if (fields.dueAt !== undefined) patch.due_at = fields.dueAt;
  if (fields.tags !== undefined) patch.tags = fields.tags;

  const { error } = await c.supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (fields.notes !== undefined && fields.notes !== prevNotes) {
    await notifyMentions(fields.notes, prevNotes, id, title, c, profiles);
  }

  refresh();
  return { ok: true, id };
}

/* ── Status / done ──────────────────────────────────────────────────────── */

export async function setStatus(id: string, status: TaskStatus): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };

  const { data: existing } = await c.supabase
    .from("tasks")
    .select("title, created_by")
    .eq("id", id)
    .maybeSingle();

  const { error } = await c.supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Tell the other stakeholders (assignees + creator) about the move.
  const row = existing as { title?: string; created_by?: string } | null;
  if (row?.title) {
    const { data: assignRows } = await c.supabase
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", id);
    const recipients = new Set<string>(
      (assignRows ?? []).map((r) => (r as { user_id: string }).user_id),
    );
    if (row.created_by) recipients.add(row.created_by);
    const label = status === "done" ? "completed" : status === "in_progress" ? "moved to In progress" : "reopened";
    await Promise.all(
      [...recipients].map((uid) =>
        notify({
          userId: uid,
          actorId: c.userId,
          type: "status",
          taskId: id,
          message: `${c.actorName} ${label} "${row.title}".`,
        }),
      ),
    );
  }

  refresh();
  return { ok: true, id };
}

/* ── Assignees ──────────────────────────────────────────────────────────── */

export async function addAssignee(
  taskId: string,
  userId: string,
  taskTitle: string,
): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.supabase
    .from("task_assignees")
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: "task_id,user_id" });
  if (error) return { ok: false, error: error.message };
  await notify({
    userId,
    actorId: c.userId,
    type: "assigned",
    taskId,
    message: `${c.actorName} assigned you "${taskTitle}".`,
  });
  refresh();
  return { ok: true };
}

export async function removeAssignee(taskId: string, userId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ── Soft-delete / restore / permanent delete ───────────────────────────── */

/* Move a task to Trash (reversible). It's an UPDATE, so the same RLS as
   editing applies (team tasks: any member; personal: creator/assignee). */
export async function deleteTask(id: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* Bring a task back from Trash. */
export async function restoreTask(id: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.supabase
    .from("tasks")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* Permanently remove a task (creator only — enforced by the DELETE RLS
   policy). Used from the Trash view. */
export async function purgeTask(id: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  const { error } = await c.supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ── @mention parsing ───────────────────────────────────────────────────── */

/* Match @handles against team profiles. A handle matches a person's first
   name or their full name with spaces removed (case-insensitive). Only newly
   added mentions (not already in the previous text) trigger a notification. */
async function notifyMentions(
  notes: string,
  prevNotes: string,
  taskId: string,
  title: string,
  c: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; actorName: string },
  profiles?: Profile[],
) {
  let people = profiles;
  if (!people) {
    const { data } = await c.supabase.from("profiles").select("id, email, full_name, avatar_url");
    people = (data ?? []) as Profile[];
  }
  if (!people.length) return;

  const mentionedNow = matchMentions(notes, people);
  const mentionedBefore = matchMentions(prevNotes, people);
  const fresh = [...mentionedNow].filter((id) => !mentionedBefore.has(id) && id !== c.userId);

  await Promise.all(
    fresh.map((uid) =>
      notify({
        userId: uid,
        actorId: c.userId,
        type: "mentioned",
        taskId,
        message: `${c.actorName} mentioned you on "${title}".`,
      }),
    ),
  );
}

function matchMentions(text: string, profiles: Profile[]): Set<string> {
  const found = new Set<string>();
  if (!text) return found;
  const tokens = text.toLowerCase().match(/@[a-z0-9._-]+/g);
  if (!tokens) return found;
  const handles = tokens.map((t) => t.slice(1));
  for (const p of profiles) {
    const name = displayName(p.full_name, p.email).toLowerCase();
    const first = name.split(/\s+/)[0];
    const full = name.replace(/\s+/g, "");
    const emailLocal = (p.email ?? "").toLowerCase().split("@")[0];
    if (handles.some((h) => h === first || h === full || (emailLocal && h === emailLocal))) {
      found.add(p.id);
    }
  }
  return found;
}
