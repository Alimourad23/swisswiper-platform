"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInstagramProfile, replyToComment, sendDirectMessage } from "@/lib/instagram/client";

/* Engagement inbox actions — a reply only ever leaves after a human clicked
   Send in the review UI (approval-first, per the agreed design). */

async function requireUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function sendCommentReply(
  commentId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireUser())) return { ok: false, error: "You're not signed in." };
  const message = text.trim();
  if (!message) return { ok: false, error: "The reply is empty." };
  try {
    await replyToComment(commentId, message);
    revalidatePath("/dashboard/marketing/engagement");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't send the reply." };
  }
}

export async function sendDmReply(
  recipientId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireUser())) return { ok: false, error: "You're not signed in." };
  const message = text.trim();
  if (!message) return { ok: false, error: "The message is empty." };
  try {
    const profile = await getInstagramProfile();
    await sendDirectMessage(profile.userId, recipientId, message);
    revalidatePath("/dashboard/marketing/engagement");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't send the message." };
  }
}
