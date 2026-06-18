import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView } from "@/lib/google/gmail";
import { getCalendarData, type CalEventRaw } from "@/lib/google/calendar";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";
import { getTasksData } from "@/lib/tasks/data";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

/* Alfred's conversation endpoint — the user talks to Alfred and he answers.
   READ-ONLY: each turn fetches the same live data the Bridge shows and injects
   a compact summary into the system prompt, so Alfred can answer "what's
   overdue?", "what's my day?", "summarise my inbox", "how's LinkedIn?". He
   advises and answers; he never performs actions yet. The Anthropic key stays
   server-side and is never exposed to the browser. */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Alfred isn't configured yet — no API key set." },
      { status: 503 },
    );
  }

  let body: { messages?: ChatMessage[]; timeZone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "I couldn't read that." }, { status: 400 });
  }

  const timeZone =
    typeof body.timeZone === "string" && body.timeZone ? body.timeZone : "UTC";

  // Sanitise + bound the conversation. Keep the last 20 turns, trim each.
  const clean: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  if (!clean.length || clean[clean.length - 1].role !== "user") {
    return NextResponse.json({ error: "There's nothing to respond to." }, { status: 400 });
  }

  // Must be signed in (Alfred only knows the signed-in person's data).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
  }
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const firstName = (meta.full_name ?? meta.name ?? user.email ?? "there").split(" ")[0] || "there";

  const context = await buildContext(timeZone);

  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const system = `You are Alfred — a refined, calm, dry-witted British butler in the spirit of Alfred Pennyworth. You are ${firstName}'s personal assistant on the SwissWiper performance platform.

Manner: warm, loyal, understated. A light, dry wit — never slapstick. Address ${firstName} by first name now and then, not every line. You are unflappable and precise.

This is spoken aloud, so keep replies short — usually one or two sentences. Lead with the answer. Don't read out long lists unless asked; summarise instead. No markdown, bullet points, or emoji — just plain spoken English.

You are READ-ONLY for now: you can answer questions, summarise, and advise, but you cannot yet take actions (sending mail, creating tasks, moving meetings). If asked to do something, say you'll be able to once actions are enabled, and offer the relevant information instead.

Base your answers on the live briefing below. If something isn't in it, say so plainly rather than inventing it. It is currently ${nowLabel} (${timeZone}).

— Live briefing for ${firstName} —
${context}`;

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages: clean,
    });
    const reply = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    return NextResponse.json({
      reply: reply || "I'm afraid I didn't quite catch that, sir. Could you say it again?",
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Alfred chat failed:", e);
    return NextResponse.json(
      { error: "I'm afraid I'm unavailable at the moment. Do try again shortly." },
      { status: 502 },
    );
  }
}

/* ── Live data summary (read-only) ─────────────────────────────────────── */

async function buildContext(timeZone: string): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const todayKey = dateKeyInTz(now, timeZone);

  // Tasks (the signed-in user's open tasks).
  try {
    const { tasks, userId } = await getTasksData();
    const mine = tasks.filter(
      (t) =>
        !t.deleted_at &&
        t.status !== "done" &&
        (t.created_by === userId || t.assignees.includes(userId ?? "")),
    );
    const overdue = mine.filter(
      (t) => t.due_at && dateKeyInTz(new Date(t.due_at), timeZone) < todayKey,
    );
    const dueToday = mine.filter(
      (t) => t.due_at && dateKeyInTz(new Date(t.due_at), timeZone) === todayKey,
    );
    lines.push(
      `Tasks: ${mine.length} open${overdue.length ? `, ${overdue.length} overdue` : ""}${
        dueToday.length ? `, ${dueToday.length} due today` : ""
      }.`,
    );
    if (overdue.length) lines.push(`Overdue: ${overdue.slice(0, 6).map((t) => t.title).join("; ")}.`);
    if (dueToday.length) lines.push(`Due today: ${dueToday.slice(0, 6).map((t) => t.title).join("; ")}.`);
  } catch {
    /* tasks unavailable */
  }

  // Gmail + Calendar (only when Google is connected).
  const token = await getGoogleAccessToken();
  if (token) {
    try {
      const inbox = await getInboxView(token);
      lines.push(
        `Inbox: ${inbox.unread} unread, ${inbox.needAttention} needing attention, ${inbox.awaitingReply} awaiting a reply, ${inbox.week} received this week.`,
      );
    } catch {
      /* inbox unavailable */
    }
    try {
      const { events } = await getCalendarData(token);
      const todays = events.filter((e) => e.isMeeting && meetingDayKey(e, timeZone) === todayKey);
      const next = events
        .filter((e) => e.isMeeting && e.startDateTime && Date.parse(e.startDateTime) > now.getTime())
        .sort((a, b) => Date.parse(a.startDateTime!) - Date.parse(b.startDateTime!))[0];
      let cal = `Calendar today: ${todays.length} meeting${todays.length === 1 ? "" : "s"}.`;
      if (next) cal += ` Next: ${next.title} at ${timeInTz(next, timeZone)}.`;
      lines.push(cal);
      if (todays.length) {
        lines.push(
          `Today's meetings: ${todays
            .slice(0, 6)
            .map((e) => `${e.title} (${timeInTz(e, timeZone)})`)
            .join("; ")}.`,
        );
      }
    } catch {
      /* calendar unavailable */
    }
  } else {
    lines.push("Gmail and Calendar aren't connected, so I have no email or calendar data right now.");
  }

  // Marketing pulse (LinkedIn — latest export, falls back to seed).
  try {
    const { metrics: li } = await getLinkedInMetrics();
    const agg = windowAgg(li, 365);
    lines.push(
      `LinkedIn (last 365 days): ${li.followersAllTime.toLocaleString()} followers, ${agg.impressions.toLocaleString()} impressions, ${(
        agg.engagementRate * 100
      ).toFixed(1)}% engagement.`,
    );
  } catch {
    /* marketing unavailable */
  }

  return lines.length ? lines.join("\n") : "No live data is available at the moment.";
}

/* YYYY-MM-DD for an instant in a given IANA timezone (string-comparable). */
function dateKeyInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function meetingDayKey(e: CalEventRaw, timeZone: string): string {
  if (e.allDayStart) return e.allDayStart;
  if (e.startDateTime) return dateKeyInTz(new Date(e.startDateTime), timeZone);
  return "";
}

function timeInTz(e: CalEventRaw, timeZone: string): string {
  if (!e.startDateTime) return "all day";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(e.startDateTime));
}
