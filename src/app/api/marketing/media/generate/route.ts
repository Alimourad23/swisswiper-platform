import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/marketing/media";

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

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  cfg?: { aspectRatio: string; imageSize: string },
): Promise<{ data: string; mime: string } | null> {
  const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
  // aspectRatio / imageSize are only honoured by the Gemini 3 image models.
  if (cfg && model.startsWith("gemini-3")) {
    generationConfig.responseFormat = { image: { aspectRatio: cfg.aspectRatio, imageSize: cfg.imageSize } };
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const json = (await res.json().catch(() => null)) as
    | { candidates?: { content?: { parts?: Part[] } }[] }
    | null;
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p.inlineData?.data ?? p.inline_data?.data;
    const m = p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png";
    if (d) return { data: d, mime: m };
  }
  return null;
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

  let body: { postId?: string; prompt?: string; model?: string; aspectRatio?: string; imageSize?: string; count?: number };
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

  const created: unknown[] = [];
  for (let i = 0; i < count; i++) {
    // Try the chosen model with the size config; fall back to the original model.
    let image = await callGemini(chosen, apiKey, STYLE + userPrompt, { aspectRatio, imageSize });
    if (!image) image = await callGemini(FALLBACK_MODEL, apiKey, STYLE + userPrompt);
    if (!image) continue;

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
    return NextResponse.json({ error: "Alfred couldn't generate an image just now." }, { status: 502 });
  }
  return NextResponse.json({ media: created });
}
