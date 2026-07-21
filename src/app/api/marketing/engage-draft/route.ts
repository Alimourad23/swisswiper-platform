import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Alfred drafts a reply to an Instagram comment or DM — in the right founder's
   voice. Product/technical questions → Etienne (CPO); everything else → Ali
   (CEO). The draft is ALWAYS reviewed and approved by a human before sending;
   this route never sends anything. */

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Alfred isn't configured." }, { status: 503 });

  let body: { kind?: string; author?: string; text?: string; postCaption?: string; history?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const kind = body.kind === "dm" ? "dm" : "comment";
  const text = (body.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "Nothing to reply to." }, { status: 400 });

  const system =
    "You draft Instagram replies for SwissWiper, a luxury hard-water glass-care brand (a precision wiper + care " +
    "system that keeps shower screens, balustrades and facades flawless). The founders answer every message " +
    "personally — your draft must sound like a real person, never like a bot or marketing copy.\n\n" +
    "Voice rules: warm, precise, understated; short sentences; no hype, no emoji unless the customer used them " +
    "first (then at most one); never discount language; say 'commission' never 'buy/order'; never qualify the " +
    "price. Match the customer's language (reply in German if they wrote German, etc.).\n\n" +
    "Choose the voice: if the message is about the product, materials, engineering, measurements, installation " +
    "or technical details → voice is 'etienne' (Etienne, co-founder & CPO — precise, quietly proud of the " +
    "engineering). Otherwise → voice is 'ali' (Ali, co-founder & CEO — warm, personal, hospitable).\n\n" +
    `Length: ${kind === "dm" ? "1–3 short sentences" : "one or two short sentences"}. No signatures, no hashtags.\n\n` +
    "Also classify the message into ONE category: compliment | product_question | price_question | complaint | " +
    "collaboration | spam | other.\n\n" +
    'Respond ONLY with JSON, no prose: {"reply": string, "voice": "ali"|"etienne", "category": string}';

  const userMsg =
    `Kind: ${kind === "dm" ? "direct message" : "comment on a post"}.\n` +
    `From: @${(body.author ?? "someone").slice(0, 80)}.\n` +
    (body.postCaption ? `On the post: "${body.postCaption.slice(0, 300)}"\n` : "") +
    (body.history ? `Conversation so far:\n${body.history.slice(0, 1500)}\n` : "") +
    `Their message: "${text}"`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const raw = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("bad output");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { reply?: string; voice?: string; category?: string };
    if (!parsed.reply) throw new Error("no reply");
    return NextResponse.json({
      reply: String(parsed.reply).slice(0, 1000),
      voice: parsed.voice === "etienne" ? "etienne" : "ali",
      category: String(parsed.category ?? "other").slice(0, 40),
    });
  } catch {
    return NextResponse.json({ error: "Alfred couldn't draft that just now — try again." }, { status: 502 });
  }
}
