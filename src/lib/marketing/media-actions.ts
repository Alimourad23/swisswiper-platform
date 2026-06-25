"use server";

import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type ContentMedia } from "@/lib/marketing/media";

/* Server actions for content media. Upload happens in the API route
   (/api/marketing/media/upload) since it handles a file body; here we list and
   delete. */

export async function getMedia(postId: string): Promise<ContentMedia[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("content_media")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ContentMedia[];
}

export async function deleteMedia(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Look up the storage path so we can remove the file too.
  const { data: row } = await supabase
    .from("content_media")
    .select("storage_path")
    .eq("id", id)
    .single();
  const path = (row as { storage_path?: string } | null)?.storage_path;
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);

  const { error } = await supabase.from("content_media").delete().eq("id", id);
  return { ok: !error };
}
