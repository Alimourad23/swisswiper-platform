import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Smart Compose — as the user writes an email, suggest a SHORT continuation in
   SwissWiper's voice. Uses a fast, small model (Haiku) for low latency. Returns
   only the text that should come immediately after what's written. Requires a
   signed-in user so the key can't be abused. */

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestion: "" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ suggestion: "" }, { status: 401 });

  let body: { written?: string; subject?: string; to?: string; isReply?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ suggestion: "" }, { status: 400 });
  }

  const written = (body.written ?? "").slice(0, 2000);
  if (written.trim().length < 3) return NextResponse.json({ suggestion: "" });

  const system =
    "You help SwissWiper's founder write emails. SwissWiper is a luxury hard-water glass-care brand; the voice is refined, warm, and concise, never discounting or pushy. " +
    "You are an autocomplete: given the partial email the writer has typed so far, output the SHORT continuation that should come immediately next — a few words, at most one sentence. " +
    "Output ONLY that continuation text (the part AFTER what's written). Do not repeat what's already written. No quotes, no preamble, no explanation. If the email already reads as complete, output nothing.";

  const userMsg =
    `${body.isReply ? "This is a reply." : "This is a new email."}` +
    `${body.to ? ` To: ${body.to}.` : ""}${body.subject ? ` Subject: ${body.subject}.` : ""}\n\n` +
    `Email so far:\n"""${written}"""\n\nContinuation:`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 40,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    let suggestion = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim()
      .replace(/^["']|["']$/g, "");

    // Join naturally: add a leading space if we're mid-sentence and the model
    // didn't supply one (and it isn't trailing punctuation).
    if (
      suggestion &&
      !/\s$/.test(written) &&
      !/^\s/.test(suggestion) &&
      !/^[.,!?;:'’)]/.test(suggestion)
    ) {
      suggestion = " " + suggestion;
    }

    return NextResponse.json({ suggestion: suggestion.slice(0, 160) });
  } catch {
    return NextResponse.json({ suggestion: "" });
  }
}
