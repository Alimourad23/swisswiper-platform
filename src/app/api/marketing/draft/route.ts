import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Draft a social post for the content schedule — Alfred writes it in SwissWiper's
   voice, tuned to the channel. Requires a signed-in user (protects the key). */

const CHANNEL_GUIDE: Record<string, string> = {
  linkedin:
    "LinkedIn: professional and credible. Open with a strong one-line hook, then 2–4 short paragraphs with line breaks. End with a quiet call to reflection, not a hard sell. 1–2 relevant hashtags at most.",
  instagram:
    "Instagram: a punchy, visual caption — evocative first line, a few short lines, then 4–6 tasteful hashtags. Aesthetic and aspirational, never salesy.",
  tiktok:
    "TikTok: a script. Start with a 1-line hook, then 3–5 short spoken beats a founder could say to camera. Natural, human, a little intriguing.",
  youtube:
    "YouTube: a title + a 2–3 sentence description hook that earns the click without clickbait.",
  website:
    "Website: a short blog-style intro — a compelling opening, then 2–3 tight paragraphs setting up the topic.",
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { title?: string; channel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const topic = (body.title ?? "").trim();
  if (!topic) return NextResponse.json({ error: "No topic." }, { status: 400 });
  const channel = (body.channel ?? "linkedin").toLowerCase();
  const guide = CHANNEL_GUIDE[channel] ?? CHANNEL_GUIDE.linkedin;

  const system =
    "You write social posts for SwissWiper — a luxury hard-water glass-care brand: a precision wiper and care system that keeps glass (shower screens, balustrades, facades) flawless in hard-water regions. " +
    "Voice: refined, calm, confident, concise; understated luxury; never discounting, never hype; prefer 'commission' over 'buy'; never qualify or undercut the price. " +
    `Write ONE ready-to-publish post for the channel below.\n\n${guide}\n\n` +
    "Output ONLY the post text — no preamble, no quotation marks, no notes.";

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: `Channel: ${channel}.\nTopic: ${topic}` }],
    });
    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Draft failed." }, { status: 502 });
  }
}
