import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/marketing/media";
import { budgetCheck, imageCost, logUsage } from "@/lib/marketing/ai-usage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* Generate image(s) for a content post with Nano Banana (Gemini image models),
   store them in Supabase Storage, and record them in content_media (source: 'ai').
   Body: { postId, prompt, model, aspectRatio, imageSize, count }.
   Requires a signed-in user + GEMINI_API_KEY. */

// Friendly model keys → Gemini model IDs.
const MODEL_IDS: Record<string, string> = {
  pro: "gemini-3-pro-image", // Nano Banana Pro — best quality, legible text
  flash: "gemini-3.1-flash-image", // Nano Banana 2 — faster / cheaper
};
const FALLBACK_MODEL = "gemini-2.5-flash-image"; // original Nano Banana, no size config

const STYLE =
  "Style: luxury, minimal, editorial product photography for a high-end brand. " +
  "Calm and refined, generous negative space, soft natural light, premium materials, " +
  "muted elegant palette. No on-image text unless explicitly requested. Subject: ";

type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
type GenResult = { data: string; mime: string } | { error: string; status?: number };

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  cfg?: { aspectRatio: string; imageSize: string },
  sourceImage?: { data: string; mime: string },
): Promise<GenResult> {
  const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
  // aspectRatio / imageSize are only honoured by the Gemini 3 image models.
  if (cfg && model.startsWith("gemini-3")) {
    generationConfig.responseFormat = { image: { aspectRatio: cfg.aspectRatio, imageSize: cfg.imageSize } };
  }
  // For image-to-image (editing), pass the source image before the instruction.
  const reqParts: unknown[] = [];
  if (sourceImage) reqParts.push({ inline_data: { mime_type: sourceImage.mime, data: sourceImage.data } });
  reqParts.push({ text: prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: reqParts }], generationConfig }),
    },
  ).catch(() => null);
  if (!res) return { error: "Couldn't reach Google." };
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let msg = "";
    try {
      msg = (JSON.parse(txt) as { error?: { message?: string } })?.error?.message ?? "";
    } catch {
      /* non-JSON body */
    }
    return { error: msg || `Google returned ${res.status}.`, status: res.status };
  }
  const json = (await res.json().catch(() => null)) as
    | { candidates?: { content?: { parts?: Part[] } }[] }
    | null;
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p.inlineData?.data ?? p.inline_data?.data;
    const m = p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png";
    if (d) return { data: d, mime: m };
  }
  return { error: "No image was returned." };
}

// Turn Google's raw error into something a non-technical user understands.
function friendlyError(raw: string, status?: number): string {
  const r = raw.toLowerCase();
  if (status === 429 || r.includes("quota") || r.includes("rate limit")) {
    return "Rate limit or quota reached. If you're on the free tier, enable billing on the Gemini project (marketing@) — or wait a moment and retry.";
  }
  if (status === 403 || r.includes("billing") || r.includes("free tier") || r.includes("not enabled") || r.includes("permission")) {
    return "This image model needs billing enabled on the Gemini project. In Google AI Studio (signed in as marketing@) → Billing, add a card, then try again.";
  }
  if (status === 400 || r.includes("safety") || r.includes("blocked")) {
    return "The request was rejected — try rewording the prompt.";
  }
  return raw ? `Google: ${raw}` : "Alfred couldn't generate an image just now.";
}

const ASPECTS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
const SIZES = new Set(["1K", "2K", "4K"]);

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image generation isn't configured yet." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { postId?: string; prompt?: string; model?: string; aspectRatio?: string; imageSize?: string; count?: number; sourceUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const postId = (body.postId ?? "").trim();
  const userPrompt = (body.prompt ?? "").trim();
  if (!postId || !userPrompt) return NextResponse.json({ error: "A post and a prompt are needed." }, { status: 400 });

  const chosen = MODEL_IDS[body.model ?? "pro"] ?? MODEL_IDS.pro;
  const aspectRatio = ASPECTS.has(body.aspectRatio ?? "") ? (body.aspectRatio as string) : "1:1";
  const imageSize = SIZES.has(body.imageSize ?? "") ? (body.imageSize as string) : "2K";
  const count = Math.min(4, Math.max(1, Math.round(body.count ?? 1)));

  // Budget guardrail: estimate this batch's cost and stop if it would exceed the cap.
  const modelKey = body.model === "flash" ? "flash" : "pro";
  const estCost = imageCost(modelKey, imageSize) * count;
  const budget = await budgetCheck(estCost);
  if (!budget.ok) {
    return NextResponse.json(
      {
        error: `Monthly AI budget reached (~$${budget.spend.toFixed(2)} of $${budget.cap.toFixed(
          0,
        )}). A founder can raise the cap in Marketing.`,
      },
      { status: 402 },
    );
  }

  // Image-to-image: fetch the source image (one of our own stored media) and pass it in.
  let sourceImage: { data: string; mime: string } | undefined;
  const sourceUrl = (body.sourceUrl ?? "").trim();
  if (sourceUrl) {
    try {
      const r = await fetch(sourceUrl);
      if (r.ok) {
        const mime = r.headers.get("content-type") || "image/png";
        const buf = Buffer.from(await r.arrayBuffer());
        sourceImage = { data: buf.toString("base64"), mime };
      }
    } catch {
      /* fall back to text-to-image if the source can't be fetched */
    }
  }
  // The size config can't be combined with an input image, so drop it for editing.
  const cfg = sourceImage ? undefined : { aspectRatio, imageSize };
  // Text-to-image gets the full brand style; image editing uses the raw instruction
  // (a heavy style preamble would fight the source image).
  const promptText = sourceImage ? userPrompt : STYLE + userPrompt;

  const created: unknown[] = [];
  let lastError = "";
  let lastStatus: number | undefined;
  for (let i = 0; i < count; i++) {
    // Try the chosen model with the size config; fall back to the original model.
    let image = await callGemini(chosen, apiKey, promptText, cfg, sourceImage);
    if ("error" in image) {
      lastError = image.error;
      lastStatus = image.status;
      image = await callGemini(FALLBACK_MODEL, apiKey, promptText, undefined, sourceImage);
    }
    if ("error" in image) {
      lastError = image.error;
      lastStatus = image.status;
      continue;
    }

    const ext = image.mime.includes("jpeg") ? "jpg" : image.mime.includes("webp") ? "webp" : "png";
    const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${i}`;
    const path = `${user.id}/${postId}/ai-${rand}.${ext}`;
    const buffer = Buffer.from(image.data, "base64");
    const { error: upErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, buffer, { contentType: image.mime, upsert: false });
    if (upErr) continue;

    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const { data: row, error: insErr } = await supabase
      .from("content_media")
      .insert({ post_id: postId, kind: "image", source: "ai", url: pub.publicUrl, storage_path: path, prompt: userPrompt })
      .select("*")
      .single();
    if (insErr) {
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      continue;
    }
    created.push(row);
  }

  if (created.length === 0) {
    return NextResponse.json({ error: friendlyError(lastError, lastStatus) }, { status: 502 });
  }
  // Log the estimated spend for what we actually generated.
  await logUsage({ kind: "image", model: modelKey, units: created.length, cost: imageCost(modelKey, imageSize) * created.length });
  return NextResponse.json({ media: created });
}
