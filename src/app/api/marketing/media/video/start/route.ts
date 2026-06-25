import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startVeo } from "@/lib/marketing/veo";
import { budgetCheck, videoCost } from "@/lib/marketing/ai-usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ASPECTS = new Set(["16:9", "9:16"]);
const RES = new Set(["720p", "1080p", "4k"]);

/* Start a Veo video generation. Founder-only (cost control). Budget-checked.
   Returns a jobId the client polls via /status. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((prof as { role?: string } | null)?.role !== "founder") {
    return NextResponse.json({ error: "Video generation is limited to founders." }, { status: 403 });
  }

  let body: { postId?: string; prompt?: string; model?: string; aspectRatio?: string; resolution?: string; seconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const postId = (body.postId ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  if (!postId || !prompt) return NextResponse.json({ error: "A post and a prompt are needed." }, { status: 400 });

  const aspectRatio = ASPECTS.has(body.aspectRatio ?? "") ? (body.aspectRatio as string) : "16:9";
  const resolution = RES.has(body.resolution ?? "") ? (body.resolution as string) : "1080p";
  const seconds = [4, 6, 8].includes(Number(body.seconds)) ? Number(body.seconds) : 8;
  const model = body.model === "fast" ? "fast" : "quality";

  const est = videoCost(seconds);
  const budget = await budgetCheck(est);
  if (!budget.ok) {
    return NextResponse.json(
      { error: `Monthly AI budget reached (~$${budget.spend.toFixed(2)} of $${budget.cap.toFixed(0)}). Raise the cap in Marketing.` },
      { status: 402 },
    );
  }

  const started = await startVeo(prompt, { model, aspectRatio, resolution, seconds });
  if (!started.name) return NextResponse.json({ error: started.error || "Couldn't start the video." }, { status: 502 });

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({ post_id: postId, status: "pending", operation: started.name, model, prompt, seconds, cost_usd: est })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Could not save the job." }, { status: 502 });

  return NextResponse.json({ jobId: (job as { id: string }).id });
}
