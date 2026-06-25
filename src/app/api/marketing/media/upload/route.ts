import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/marketing/media";

export const dynamic = "force-dynamic";

/* Upload an image or video for a content post into Supabase Storage, then record
   it in content_media. Multipart body: { postId, file }. Requires a signed-in
   user. Returns the new media row. */

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const postId = String(form.get("postId") ?? "").trim();
  const file = form.get("file");
  if (!postId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing post or file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
  }

  const type = file.type || "";
  const kind = type.startsWith("video/") ? "video" : "image";
  const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "png")).toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  const path = `${user.id}/${postId}/${rand}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, { contentType: type || undefined, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: "Upload failed. Has the media bucket been created?" }, { status: 502 });
  }

  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { data: row, error: insErr } = await supabase
    .from("content_media")
    .insert({ post_id: postId, kind, source: "upload", url, storage_path: path })
    .select("*")
    .single();
  if (insErr) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return NextResponse.json({ error: "Could not save media." }, { status: 502 });
  }

  return NextResponse.json({ media: row });
}
