import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pollVeo, downloadVeo } from "@/lib/marketing/veo";
import { MEDIA_BUCKET } from "@/lib/marketing/media";
import { logUsage } from "@/lib/marketing/ai-usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Poll a Veo job. While the operation runs, returns { status: 'pending' }. When
   it finishes, downloads the clip, stores it in content_media, logs the spend,
   and returns the new media row. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "No job." }, { status: 400 });

  const { data: jobRow } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle();
  const job = jobRow as
    | {
        id: string;
        post_id: string;
        created_by: string;
        status: string;
        operation: string;
        model: string;
        seconds: number;
        cost_usd: number;
        media_id: string | null;
        error: string | null;
      }
    | null;
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  if (job.status === "done" && job.media_id) {
    const { data: media } = await supabase.from("content_media").select("*").eq("id", job.media_id).maybeSingle();
    return NextResponse.json({ status: "done", media });
  }
  if (job.status === "error") return NextResponse.json({ status: "error", error: job.error || "Generation failed." });

  // Still running?
  const poll = await pollVeo(job.operation);
  if (!poll.done) return NextResponse.json({ status: "pending" });
  if (poll.error || !poll.uri) {
    await supabase.from("video_jobs").update({ status: "error", error: poll.error ?? "No video." }).eq("id", job.id);
    return NextResponse.json({ status: "error", error: poll.error ?? "No video returned." });
  }

  // Done — download, store, log.
  const dl = await downloadVeo(poll.uri);
  if (!dl) {
    await supabase.from("video_jobs").update({ status: "error", error: "Download failed." }).eq("id", job.id);
    return NextResponse.json({ status: "error", error: "Couldn't download the finished video." });
  }
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  const path = `${job.created_by}/${job.post_id}/veo-${rand}.mp4`;
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, dl.data, { contentType: dl.mime });
  if (upErr) {
    await supabase.from("video_jobs").update({ status: "error", error: "Storage failed." }).eq("id", job.id);
    return NextResponse.json({ status: "error", error: "Couldn't store the video." });
  }
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { data: media } = await supabase
    .from("content_media")
    .insert({ post_id: job.post_id, kind: "video", source: "ai", url: pub.publicUrl, storage_path: path })
    .select("*")
    .single();

  await supabase
    .from("video_jobs")
    .update({ status: "done", media_id: (media as { id?: string } | null)?.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", job.id);
  await logUsage({ kind: "video", model: job.model, units: job.seconds, cost: Number(job.cost_usd) || 0 });

  return NextResponse.json({ status: "done", media });
}
