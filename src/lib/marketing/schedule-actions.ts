"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContentPost, ContentStatus } from "@/lib/marketing/schedule";
import { publishSingleInstagramPost } from "@/lib/marketing/publish";

/* Server actions for the content schedule. Team-collaborative (RLS lets any
   teammate read/edit). Types + constants live in `schedule.ts`. */

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
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.channel !== undefined) patch.channel = fields.channel;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.scheduledFor !== undefined) patch.scheduled_for = fields.scheduledFor;
  if (fields.format !== undefined) patch.format = fields.format;
  if (fields.body !== undefined) patch.body = fields.body;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  const { error } = await c.supabase.from("content_posts").update(patch).eq("id", id);
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}

export async function deletePost(id: string): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  const { error } = await c.supabase.from("content_posts").delete().eq("id", id);
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
  const res = await publishSingleInstagramPost(c.supabase, postId);
  revalidatePath("/dashboard/marketing");
  return res;
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
