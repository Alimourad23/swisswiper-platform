"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditModule, getAccess } from "@/lib/auth/guard";
import { logChange } from "@/lib/audit/log";
import type { ContentPost, ContentStatus } from "@/lib/marketing/schedule";
import { publishSingleInstagramPost } from "@/lib/marketing/publish";

/* Server actions for the content schedule. Reads are open to anyone with access
   to Marketing; writes require EDIT on Marketing (canEditModule), so a View-only
   member can never create, change, delete or publish — even via the API. */

async function uid(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, id: user.id } : null;
}

export async function getContentPosts(): Promise<ContentPost[]> {
  const c = await uid();
  if (!c) return [];
  const { data } = await c.supabase
    .from("content_posts")
    .select("*")
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as ContentPost[];
}

export async function createPost(input: {
  title: string;
  channel?: string;
  status?: ContentStatus;
  scheduledFor?: string | null;
  format?: string;
}): Promise<{ ok: boolean; id?: string }> {
  const c = await uid();
  if (!c) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const title = input.title.trim();
  if (!title) return { ok: false };
  const { data, error } = await c.supabase
    .from("content_posts")
    .insert({
      created_by: c.id,
      title,
      channel: input.channel ?? "linkedin",
      status: input.status ?? (input.scheduledFor ? "scheduled" : "idea"),
      scheduled_for: input.scheduledFor ?? null,
      format: input.format ?? "",
    })
    .select("id")
    .single();
  if (!error) await logChange({ action: "Created post", module: "marketing", target: title });
  revalidatePath("/dashboard/marketing");
  return { ok: !error, id: (data as { id?: string } | null)?.id };
}

/* Create many posts at once (used by the manual planner). Each becomes a
   scheduled post on its assigned date. */
export async function createPostsBulk(
  items: {
    title: string;
    channel: string;
    scheduledFor: string;
    notes?: string;
    seedIdea?: string;
    goal?: string;
    source?: string;
  }[],
): Promise<{ ok: boolean; added: number }> {
  const c = await uid();
  if (!c) return { ok: false, added: 0 };
  if (!(await canEditModule("marketing"))) return { ok: false, added: 0 };
  const rows = items
    .filter((it) => it.title.trim())
    .map((it) => ({
      created_by: c.id,
      title: it.title.trim(),
      channel: it.channel || "linkedin",
      status: "scheduled",
      scheduled_for: it.scheduledFor || null,
      notes: it.notes ?? "",
      seed_idea: it.seedIdea ?? null,
      goal: it.goal ?? null,
      source: it.source ?? "manual",
    }));
  if (rows.length === 0) return { ok: true, added: 0 };
  const { error } = await c.supabase.from("content_posts").insert(rows);
  revalidatePath("/dashboard/marketing/pipeline");
  revalidatePath("/dashboard/marketing/calendar");
  return { ok: !error, added: rows.length };
}

export async function updatePost(
  id: string,
  fields: { title?: string; channel?: string; status?: ContentStatus; scheduledFor?: string | null; format?: string; body?: string; notes?: string },
): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.channel !== undefined) patch.channel = fields.channel;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.scheduledFor !== undefined) patch.scheduled_for = fields.scheduledFor;
  if (fields.format !== undefined) patch.format = fields.format;
  if (fields.body !== undefined) patch.body = fields.body;
  if (fields.notes !== undefined) patch.notes = fields.notes;

  // Editing the actual content of an already-approved post invalidates the
  // sign-off — reset it to draft so it must be re-submitted and re-approved.
  const contentChanged =
    fields.title !== undefined || fields.body !== undefined || fields.format !== undefined;

  // For a status change we log before → after, so read the current status first.
  // We also need the current approval_status to know whether to reset it.
  let prevStatus: string | null = null;
  let postTitle: string | null = null;
  if (fields.status !== undefined || contentChanged) {
    const { data: cur } = await c.supabase
      .from("content_posts")
      .select("status, title, approval_status")
      .eq("id", id)
      .maybeSingle();
    prevStatus = (cur as { status?: string } | null)?.status ?? null;
    postTitle = (cur as { title?: string } | null)?.title ?? null;
    const prevApproval = (cur as { approval_status?: string } | null)?.approval_status ?? "none";
    if (contentChanged && prevApproval === "approved") {
      patch.approval_status = "none";
      patch.approved_by = null;
      patch.approved_at = null;
    }
  }

  const { error } = await c.supabase.from("content_posts").update(patch).eq("id", id);
  if (!error && fields.status !== undefined && fields.status !== prevStatus) {
    await logChange({
      action: "Changed post status",
      module: "marketing",
      target: postTitle ?? id,
      before: prevStatus,
      after: fields.status,
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

/* Instagram only: arm/disarm auto-publishing for a scheduled post. When ON, the
   daily publish cron posts it to Instagram on/after its scheduled date. */
export async function setAutoPublish(id: string, value: boolean): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const { error } = await c.supabase
    .from("content_posts")
    .update({ auto_publish: value, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) {
    await logChange({
      action: value ? "Armed auto-publish" : "Disarmed auto-publish",
      module: "marketing",
      target: id,
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

export async function deletePost(id: string): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const { data: row } = await c.supabase.from("content_posts").select("title").eq("id", id).maybeSingle();
  const { error } = await c.supabase.from("content_posts").delete().eq("id", id);
  if (!error) {
    await logChange({
      action: "Deleted post",
      module: "marketing",
      target: (row as { title?: string } | null)?.title ?? id,
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

/* Publish an Instagram post right now (manual "Publish now" from the composer).
   Instagram-only — LinkedIn has no publishing API (read-only from the export).
   The post must have media attached; publishSingleInstagramPost surfaces a
   friendly error otherwise. */
export async function publishInstagramNow(
  postId: string,
): Promise<{ ok: boolean; permalink?: string | null; error?: string }> {
  const c = await uid();
  if (!c) return { ok: false, error: "You're not signed in." };
  if (!(await canEditModule("marketing"))) return { ok: false, error: "You have view-only access to Marketing." };

  // Approval gate. A post must be approved to go live. A founder publishing
  // directly counts as approving it (their publish IS the sign-off); a non-founder
  // is blocked until a founder approves.
  const { data: apRow } = await c.supabase
    .from("content_posts")
    .select("approval_status, title")
    .eq("id", postId)
    .maybeSingle();
  const approval = (apRow as { approval_status?: string } | null)?.approval_status ?? "none";
  if (approval !== "approved") {
    const access = await getAccess();
    if (!access.manager) {
      return { ok: false, error: "This post needs a founder's approval before it can be published." };
    }
    await c.supabase
      .from("content_posts")
      .update({ approval_status: "approved", approved_by: c.id, approved_at: new Date().toISOString() })
      .eq("id", postId);
    await logChange({
      action: "Approved post (on publish)",
      module: "marketing",
      target: (apRow as { title?: string } | null)?.title ?? postId,
      after: "approved",
    });
  }

  const res = await publishSingleInstagramPost(c.supabase, postId);
  if (res.ok) {
    await logChange({
      action: "Published to Instagram",
      module: "marketing",
      target: postId,
      after: res.permalink ?? null,
    });
  }
  revalidatePath("/dashboard/marketing");
  return res;
}

/* ---- Approval workflow ------------------------------------------------
   Anyone with Edit on Marketing can submit a post for approval. Only a founder
   (manager) can approve it or send it back for changes. Publishing is gated on
   'approved' in publishInstagramNow (manual) and the auto-publish cron. */

export async function submitForApproval(id: string): Promise<{ ok: boolean; error?: string }> {
  const c = await uid();
  if (!c) return { ok: false, error: "You're not signed in." };
  if (!(await canEditModule("marketing"))) return { ok: false, error: "You have view-only access to Marketing." };
  const { data: row } = await c.supabase.from("content_posts").select("title").eq("id", id).maybeSingle();
  const { error } = await c.supabase
    .from("content_posts")
    .update({
      approval_status: "pending",
      submitted_by: c.id,
      submitted_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (!error) {
    await logChange({
      action: "Submitted for approval",
      module: "marketing",
      target: (row as { title?: string } | null)?.title ?? id,
      after: "pending",
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

export async function approvePost(id: string): Promise<{ ok: boolean; error?: string }> {
  const c = await uid();
  if (!c) return { ok: false, error: "You're not signed in." };
  const access = await getAccess();
  if (!access.manager) return { ok: false, error: "Only a founder can approve posts." };
  const { data: row } = await c.supabase
    .from("content_posts")
    .select("title, approval_status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await c.supabase
    .from("content_posts")
    .update({
      approval_status: "approved",
      approved_by: c.id,
      approved_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (!error) {
    await logChange({
      action: "Approved post",
      module: "marketing",
      target: (row as { title?: string } | null)?.title ?? id,
      before: (row as { approval_status?: string } | null)?.approval_status ?? "none",
      after: "approved",
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

export async function requestChanges(id: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const c = await uid();
  if (!c) return { ok: false, error: "You're not signed in." };
  const access = await getAccess();
  if (!access.manager) return { ok: false, error: "Only a founder can request changes." };
  const clean = (note ?? "").trim() || null;
  const { data: row } = await c.supabase.from("content_posts").select("title").eq("id", id).maybeSingle();
  const { error } = await c.supabase
    .from("content_posts")
    .update({ approval_status: "changes", review_note: clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) {
    await logChange({
      action: "Requested changes",
      module: "marketing",
      target: (row as { title?: string } | null)?.title ?? id,
      after: clean,
    });
  }
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

/* Upcoming (not-yet-published) posts for one channel — feeds the "Planned &
   upcoming" panel on each channel's Content page. */
export async function getPlannedFor(
  channel: string,
): Promise<{ title: string; scheduled_for: string | null; status: string; format: string }[]> {
  const posts = await getContentPosts();
  return posts
    .filter((p) => p.channel === channel && p.status !== "published")
    .map((p) => ({ title: p.title, scheduled_for: p.scheduled_for, status: p.status, format: p.format }));
}
