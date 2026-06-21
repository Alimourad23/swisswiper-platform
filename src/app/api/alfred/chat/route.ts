import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView } from "@/lib/google/gmail";
import { getCalendarData, type CalEventRaw } from "@/lib/google/calendar";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";
import { getTasksData, type TasksData } from "@/lib/tasks/data";
import { displayName } from "@/lib/tasks/format";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

/* Alfred's conversation endpoint — the user talks to Alfred and he answers.
   Each turn fetches the same live data the Bridge shows and injects a compact
   summary into the system prompt. Alfred can also ACT via a small whitelist of
   tools (Anthropic tool-use): navigate (safe, immediate) and create_task /
   set_task_status (proposals the CLIENT confirms before executing). The route
   never performs data changes itself — it only relays the proposed tool calls
   plus a resolution directory (real teammates + open tasks) so the client can
   resolve names/titles and confirm. The Anthropic key stays server-side. */

const TOOLS: Anthropic.Tool[] = [
  {
    name: "navigate",
    description:
      "Take the user to a section of the SwissWiper dashboard. Use when they ask to go to / open / show a section. This is safe and immediate — no confirmation needed.",
    input_schema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: ["overview", "tasks", "calendar", "emails", "marketing", "bridge"],
          description: "Which section to open.",
        },
      },
      required: ["destination"],
    },
  },
  {
    name: "create_task",
    description:
      "PROPOSE creating a new task on the shared team to-do list. This is only a proposal — the app shows the user an editable review before anything is created, so phrase your spoken reply as a proposal, not as done. A task may involve several people: list every teammate in assigneeNames. Only use real teammates from the roster; if you're unsure who is meant, ask instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The task title." },
        assigneeNames: {
          type: "array",
          items: { type: "string" },
          description:
            "First or full names of real teammates to assign (one or more). Omit if not specified.",
        },
        dueDate: {
          type: "string",
          description: "Absolute due date as YYYY-MM-DD. Convert relative dates (e.g. 'Friday') yourself. Omit if none.",
        },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        visibility: { type: "string", enum: ["team", "personal", "founders"] },
      },
      required: ["title"],
    },
  },
  {
    name: "set_task_status",
    description:
      "PROPOSE changing the status of an existing task (e.g. mark it done). Only a proposal — the app confirms with the user before applying it. Match taskTitleOrId to one of the user's open tasks listed in the briefing; if none matches, ask which task they mean instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        taskTitleOrId: { type: "string", description: "The exact title (or id) of an existing task." },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
      },
      required: ["taskTitleOrId", "status"],
    },
  },
];

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

  // Fetch tasks once — used for the briefing AND the resolution directory.
  const tasksData = await getTasksData().catch(() => null);
  const directory = buildDirectory(tasksData);
  const context = await buildContext(timeZone, tasksData, directory);

  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const todayIso = dateKeyInTz(new Date(), timeZone);

  const system = `You are Alfred — a refined, calm, dry-witted British butler in the spirit of Alfred Pennyworth. You are ${firstName}'s personal assistant on the SwissWiper performance platform.

Manner: warm, loyal, understated. A light, dry wit — never slapstick. Address ${firstName} by first name now and then, not every line. You are unflappable and precise.

This is spoken aloud, so keep replies short — usually one or two sentences. Lead with the answer. Don't read out long lists unless asked; summarise instead. No markdown, bullet points, or emoji — just plain spoken English.

Marketing: the LinkedIn figures in the briefing ARE the marketing performance data. When ${firstName} asks "how's marketing?", answer from those LinkedIn numbers.

You can take a few actions through tools:
- navigate(destination): take ${firstName} to a section. This is immediate — when you navigate, give a brief spoken confirmation like "Right away — taking you to Marketing."
- create_task and set_task_status: these are PROPOSALS only. The app will let ${firstName} review/edit and confirm before anything changes, so phrase your spoken line as a proposal ("Shall I create…?") — never claim it's already done. A task can involve several people — put every teammate in assigneeNames. Only use real teammates from the roster below; if you're unsure who or which task is meant, ask rather than guess. For due dates, pass an absolute YYYY-MM-DD (today is ${todayIso}).
- You cannot yet send emails or change the calendar — if asked, say that's coming soon and offer the relevant information instead.

Base your answers on the live briefing below. If something isn't in it, say so plainly rather than inventing it. It is currently ${nowLabel} (${timeZone}).

— Live briefing for ${firstName} —
${context}`;

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages: clean,
    });

    const reply = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();

    const actions = resp.content
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const tb = b as { id: string; name: string; input: unknown };
        return { id: tb.id, name: tb.name, input: (tb.input ?? {}) as Record<string, unknown> };
      });

    const needsDirectory = actions.some(
      (a) => a.name === "create_task" || a.name === "set_task_status",
    );

    return NextResponse.json({
      reply: reply || (actions.length ? "" : "I'm afraid I didn't quite catch that. Could you say it again?"),
      actions,
      directory: needsDirectory ? directory : undefined,
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

/* ── Resolution directory (real teammates + open tasks) ────────────────── */

type Directory = {
  profiles: { id: string; name: string; first: string }[];
  openTasks: { id: string; title: string }[];
  userRole: "member" | "founder";
};

function buildDirectory(tasksData: TasksData | null): Directory {
  const profiles = (tasksData?.profiles ?? []).map((p) => {
    const name = displayName(p.full_name, p.email);
    return { id: p.id, name, first: name.split(" ")[0] };
  });
  const openTasks = (tasksData?.tasks ?? [])
    .filter((t) => !t.deleted_at && t.status !== "done")
    .map((t) => ({ id: t.id, title: t.title }));
  return { profiles, openTasks, userRole: tasksData?.userRole ?? "member" };
}

/* ── Live data summary ─────────────────────────────────────────────────── */

async function buildContext(
  timeZone: string,
  tasksData: TasksData | null,
  directory: Directory,
): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const todayKey = dateKeyInTz(now, timeZone);

  // Tasks (the signed-in user's open tasks).
  if (tasksData) {
    const { tasks, userId } = tasksData;
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
  }

  // Roster + open task titles — so Alfred matches real names/titles for actions.
  if (directory.profiles.length) {
    lines.push(`Team: ${directory.profiles.map((p) => p.name).join(", ")}.`);
  }
  if (directory.openTasks.length) {
    lines.push(`Open tasks: ${directory.openTasks.slice(0, 12).map((t) => t.title).join("; ")}.`);
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

  // Marketing pulse (LinkedIn — latest export, always falls back to seed so it
  // loads reliably each turn). These figures ARE the marketing data.
  try {
    const { metrics: li } = await getLinkedInMetrics();
    const agg = windowAgg(li, 365);
    lines.push(
      `Marketing (LinkedIn, last 365 days): ${li.followersAllTime.toLocaleString()} followers, ${agg.impressions.toLocaleString()} impressions, ${(
        agg.engagementRate * 100
      ).toFixed(1)}% engagement.`,
    );
  } catch {
    lines.push("Marketing (LinkedIn) figures are momentarily unavailable.");
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
