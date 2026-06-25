import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* The content studio — a co-writing conversation between Ali and Alfred about ONE
   post. Ali shares thoughts / raw notes / asks for changes; Alfred gives honest,
   channel-aware feedback and, when asked, rewrites the full post body.
   Returns { reply, draft } — draft is the complete new body, or null when Alfred
   is only discussing. Requires a signed-in user (protects the key). */

const CHANNEL_GUIDE: Record<string, string> = {
  linkedin:
    "LinkedIn: professional and credible. A strong one-line hook, then 2–4 short paragraphs with line breaks, ending on a quiet reflection — never a hard sell. 1–2 hashtags at most. Sweet spot ~120–200 words.",
  instagram:
    "Instagram: a punchy, visual caption — evocative first line, a few short lines, 4–6 tasteful hashtags. Aesthetic and aspirational, never salesy.",
  tiktok:
    "TikTok: a spoken script. A 1-line hook, then 3–5 short beats a founder could say to camera. Natural, human, a little intriguing. ~30–45 seconds.",
  youtube:
    "YouTube: a title plus a 2–3 sentence description hook that earns the click without clickbait.",
  website:
    "Website: a short blog-style piece — a compelling opening, then 2–3 tight paragraphs.",
};

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { messages?: Msg[]; draft?: string; channel?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const channel = (body.channel ?? "linkedin").toLowerCase();
  const guide = CHANNEL_GUIDE[channel] ?? CHANNEL_GUIDE.linkedin;
  const title = (body.title ?? "").trim();
  const draft = (body.draft ?? "").trim();
  let history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16);
  // The conversation must start with the user's turn (drop the seeded greeting and
  // any leading assistant messages) so it alternates cleanly after the priming.
  while (history.length && history[0].role === "assistant") history = history.slice(1);
  if (history.length === 0) return NextResponse.json({ error: "No message." }, { status: 400 });

  const system =
    "You are Alfred, SwissWiper's marketing co-pilot and creative director — sharp, candid, and warm. " +
    "SwissWiper is a luxury hard-water glass-care brand: a precision wiper and care system that keeps glass " +
    "(shower screens, balustrades, facades) flawless in hard-water regions. " +
    "Brand voice: refined, calm, confident, concise; understated luxury; never discounting, never hype; " +
    "prefer 'commission' over 'buy'; never qualify or undercut the price. " +
    `You and the user are co-writing ONE post for ${channel}.\n\n${guide}\n\n` +
    "How you work: give honest, specific feedback tied to this channel — hook strength, length, structure, what to cut. " +
    "Don't flatter; if the draft is weak, say why and fix it. When the user shares raw thoughts or asks you to write, " +
    "produce the FULL updated post body (not a fragment). When you're only discussing or asking a clarifying question, leave the draft unchanged.\n\n" +
    "Respond ONLY with a JSON object, no markdown, no text outside it:\n" +
    '{"reply": string, "draft": string | null}\n' +
    "- reply: what you say to the user — concise and conversational, usually 1–4 sentences.\n" +
    "- draft: the COMPLETE new post body when you have written or revised it; null when you are only talking.\n" +
    "Use real line breaks inside the draft string. Never put anything outside the JSON object.";

  const context =
    `Post title/topic: ${title || "(untitled)"}\n` +
    `Current draft:\n${draft || "(empty — nothing written yet)"}`;

  const messages: Msg[] = [
    { role: "user", content: context },
    { role: "assistant", content: "Understood. I have the current draft in view." },
    ...history,
  ];

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system,
      messages,
    });
    const raw = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    let reply = raw;
    let newDraft: string | null = null;
    const start = raw.indexOf("{");
    const endIdx = raw.lastIndexOf("}");
    if (start !== -1 && endIdx > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, endIdx + 1));
        if (typeof parsed.reply === "string") reply = parsed.reply;
        if (typeof parsed.draft === "string" && parsed.draft.trim()) newDraft = parsed.draft;
      } catch {
        /* fall back to raw as the reply */
      }
    }
    return NextResponse.json({ reply, draft: newDraft });
  } catch {
    return NextResponse.json({ error: "Alfred is unavailable." }, { status: 502 });
  }
}
