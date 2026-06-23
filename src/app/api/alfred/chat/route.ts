import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";
import { getCalendarData, type CalEventRaw } from "@/lib/google/calendar";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";
import { getTasksData, type TasksData } from "@/lib/tasks/data";
import { displayName } from "@/lib/tasks/format";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CalendarData = { events: CalEventRaw[] };

/* Alfred's conversation endpoint. Each turn fetches the live data the Bridge
   shows and injects a compact summary into the system prompt. Alfred can ACT via
   a whitelist of tools (Anthropic tool-use): navigate (safe, immediate), task
   create/mark-done, Gmail draft/send, and calendar create/reschedule/cancel.
   The route NEVER changes data itself — it relays the proposed tool calls plus a
   resolution directory (teammates, open tasks, recent emails, upcoming events)
   so the CLIENT can resolve refs and confirm before executing. Key stays
   server-side. */

const TOOLS: Anthropic.Tool[] = [
  {
    name: "navigate",
    description:
      "Take the user to a section of the SwissWiper dashboard. Use when they ask to go to / open / show a section. Safe and immediate — no confirmation needed.",
    input_schema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: ["overview", "tasks", "calendar", "emails", "marketing", "bridge"],
        },
      },
      required: ["destination"],
    },
  },
  {
    name: "create_task",
    description:
      "PROPOSE creating a task on the shared team to-do. Only a proposal — the app shows an editable review and confirms before creating. List every teammate in assigneeNames (real names from the roster only); if unsure who, ask.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        assigneeNames: { type: "array", items: { type: "string" } },
        dueDate: { type: "string", description: "Absolute YYYY-MM-DD. Convert relative dates yourself." },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        visibility: { type: "string", enum: ["team", "personal", "founders"] },
      },
      required: ["title"],
    },
  },
  {
    name: "set_task_status",
    description:
      "PROPOSE changing an existing task's status (e.g. mark done). Only a proposal — the app confirms. Match taskTitleOrId to one of the open tasks in the briefing; if none matches, ask.",
    input_schema: {
      type: "object",
      properties: {
        taskTitleOrId: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
      },
      required: ["taskTitleOrId", "status"],
    },
  },
  {
    name: "draft_reply",
    description:
      "PROPOSE a reply to an email, saved as a DRAFT in Gmail (never sent). The app shows an editable review and confirms before drafting. Match emailRef to one of the recent emails in the briefing (by sender and/or subject); if unsure which, ask.",
    input_schema: {
      type: "object",
      properties: {
        emailRef: { type: "string", description: "Which email to reply to — the sender and/or subject." },
        body: { type: "string", description: "The reply text." },
        cc: { type: "array", items: { type: "string" }, description: "Optional Cc — emails or teammate names." },
        bcc: { type: "array", items: { type: "string" }, description: "Optional Bcc — emails or teammate names." },
      },
      required: ["emailRef", "body"],
    },
  },
  {
    name: "draft_email",
    description:
      "PROPOSE a brand-new email, saved as a DRAFT in Gmail (never sent). The app shows an editable review and confirms before drafting.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient — an email address, or a teammate's name." },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "array", items: { type: "string" }, description: "Optional Cc — emails or teammate names." },
        bcc: { type: "array", items: { type: "string" }, description: "Optional Bcc — emails or teammate names." },
      },
      required: ["to", "body"],
    },
  },
  {
    name: "send_email",
    description:
      "SEND an email (not a draft). Use ONLY when the user clearly says to send it. Still a proposal — the app confirms with a distinct Send step. Default to drafting; do not use this unless sending is explicit. Provide emailRef to send a reply to that email, or to/subject for a new message.",
    input_schema: {
      type: "object",
      properties: {
        emailRef: { type: "string", description: "Reply target (sender/subject) if sending a reply." },
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "array", items: { type: "string" }, description: "Optional Cc — emails or teammate names." },
        bcc: { type: "array", items: { type: "string" }, description: "Optional Bcc — emails or teammate names." },
      },
      required: ["body"],
    },
  },
  {
    name: "create_event",
    description:
      "PROPOSE a new calendar event on the primary calendar. Only a proposal — the app shows an editable review and confirms. Times are ISO 8601 local in the user's timezone, e.g. 2026-06-22T15:00.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "Start, ISO 8601 local (e.g. 2026-06-22T15:00)." },
        end: { type: "string", description: "End, ISO 8601 local. If omitted, default to one hour after start." },
        attendees: { type: "array", items: { type: "string" }, description: "Emails or teammate names." },
        description: { type: "string" },
        recurrence: {
          type: "string",
          enum: ["none", "daily", "weekly", "weekdays", "monthly"],
          description:
            "How often it repeats. 'weekly' = same weekday as the start; 'weekdays' = Mon–Fri; 'monthly' = same date each month. Default 'none' (one-off). Infer from phrasing like 'every Monday' (weekly), 'daily standup', 'every weekday', 'monthly review'.",
        },
      },
      required: ["title", "start"],
    },
  },
  {
    name: "reschedule_event",
    description:
      "PROPOSE moving an existing event. Only a proposal — the app confirms. Match eventRef to one of the upcoming events in the briefing (by title/time); if unsure, ask. Times are ISO 8601 local.",
    input_schema: {
      type: "object",
      properties: {
        eventRef: { type: "string", description: "Which event — its title and/or time." },
        newStart: { type: "string", description: "New start, ISO 8601 local." },
        newEnd: { type: "string", description: "New end, ISO 8601 local. Optional — keeps the duration if omitted." },
      },
      required: ["eventRef", "newStart"],
    },
  },
  {
    name: "cancel_event",
    description:
      "PROPOSE cancelling (deleting) an existing event. Only a proposal — the app shows a clear confirm. Match eventRef to one of the upcoming events; if unsure, ask.",
    input_schema: {
      type: "object",
      properties: {
        eventRef: { type: "string", description: "Which event — its title and/or time." },
      },
      required: ["eventRef"],
    },
  },
];

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Alfred isn't configured yet — no API key set." }, { status: 503 });
  }

  let body: { messages?: ChatMessage[]; timeZone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "I couldn't read that." }, { status: 400 });
  }

  const timeZone = typeof body.timeZone === "string" && body.timeZone ? body.timeZone : "UTC";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
  }
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const firstName = (meta.full_name ?? meta.name ?? user.email ?? "there").split(" ")[0] || "there";

  // Fetch live data once — used for both the briefing and the resolution directory.
  const tasksData = await getTasksData().catch(() => null);
  const token = await getGoogleAccessToken();
  let inbox: InboxView | null = null;
  let calendar: CalendarData | null = null;
  if (token) {
    try {
      inbox = await getInboxView(token);
    } catch {
      /* inbox unavailable */
    }
    try {
      calendar = await getCalendarData(token);
    } catch {
      /* calendar unavailable */
    }
  }

  const directory = buildDirectory(tasksData, inbox, calendar, user.email ?? "");
  const context = await buildContext(timeZone, tasksData, directory, inbox, calendar);

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

Manner: warm, loyal, understated. A light, dry wit — never slapstick. Address ${firstName} by first name now and then. Unflappable and precise.

This is spoken aloud, so keep replies short — usually one or two sentences. Lead with the answer. No markdown, bullet points, or emoji — plain spoken English.

Marketing: the LinkedIn figures in the briefing ARE the marketing performance data — answer "how's marketing?" from them.

About SwissWiper (use this whenever you draft an email or answer about the company): SwissWiper is a luxury hard-water glass-care brand — a precision wiper and care system that keeps glass (shower screens, balustrades, facades) flawless in hard-water regions. Positioning is understated luxury: calm, exact, no hype. Voice when writing on ${firstName}'s behalf: refined, warm, confident, and brief; never use discounting or pushy sales language; prefer "commission" over "buy/order"; never qualify or undercut the price. ${firstName} is the founder. When you draft a reply, READ the original email provided to you and respond to its actual content in this voice, sign off as ${firstName} unless told otherwise, and keep it concise.

You can take actions through tools. CRITICAL: to DO anything — create a task, draft or send an email, create/move/cancel a calendar event, mark a task done — you MUST call the matching tool. Acknowledging in words alone ("Very good, sir", "I'll draft that") does NOTHING — if you don't call the tool, nothing happens and the review panel never appears. So whenever ${firstName} clearly asks for one of these, CALL the tool in the same turn (you may also say a short proposal line). ALL tools except navigate are PROPOSALS: the app shows ${firstName} an editable review and he confirms (or says "yes") before anything happens — so phrase your spoken line as a proposal ("Shall I…?", "I've drafted…"), never as already done.
- navigate(destination): immediate; give a brief spoken confirmation.
- create_task / set_task_status: the team to-do. Real teammates only (roster below); absolute YYYY-MM-DD due dates (today is ${todayIso}).
- draft_reply / draft_email: compose email saved as a DRAFT in Gmail — you do NOT send. After confirming, say "I've drafted it in your Gmail." Match emailRef to a recent email below. When the user's message includes the original email text, your SPOKEN reply for the proposal should: (1) in one short sentence, say what their email is about; (2) read your drafted reply aloud; (3) offer "Shall I send it, save it as a draft, redraft, or cancel?". Keep it natural, not robotic. You can also be asked to add/remove/move recipients between To, Cc and Bcc — use the cc/bcc fields (names or emails) and keep the rest of the draft intact.
- send_email: actually SENDS — use ONLY when ${firstName} clearly says to send it. Default to drafting; the app confirms sending separately.
- create_event / reschedule_event / cancel_event: the primary calendar. Times are ISO 8601 local in ${firstName}'s timezone (e.g. 2026-06-22T15:00). Match eventRef to an upcoming event below. Cancelling needs a clear confirm.
If you're unsure which person, email, task, or event is meant, ASK rather than guess. If Gmail/Calendar isn't connected, say so.

Revising a proposal: when ${firstName} is reviewing a proposal and asks for a change in plain language (e.g. "make it friendlier", "mention his holiday", "make it shorter", "change the due date to Monday", "add Etienne too"), re-call the SAME tool with the change applied to the current values you're given, and briefly acknowledge it naturally (e.g. "Of course — warming it up." or "Done — due Monday now."). Keep replies to that one short sentence; the app re-shows the updated review. If instead they ask something unrelated while reviewing, just answer them — the review stays open.

Base answers on the live briefing below; if something isn't there, say so plainly. It is currently ${nowLabel} (${timeZone}).

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

    return NextResponse.json({
      reply: reply || (actions.length ? "" : "I'm afraid I didn't quite catch that. Could you say it again?"),
      actions,
      // Always include the directory so the client can resolve names/refs in
      // any context (Bridge or summon overlay).
      directory,
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

/* ── Resolution directory ──────────────────────────────────────────────── */

type Directory = {
  profiles: { id: string; name: string; first: string; email: string }[];
  openTasks: { id: string; title: string }[];
  emails: { ref: string; messageId: string; from: string; fromEmail: string; subject: string }[];
  events: { ref: string; id: string; title: string; start: string; end: string; when: string }[];
  userEmail: string;
  userRole: "member" | "founder";
};

function buildDirectory(
  tasksData: TasksData | null,
  inbox: InboxView | null,
  calendar: CalendarData | null,
  userEmail: string,
): Directory {
  const profiles = (tasksData?.profiles ?? []).map((p) => {
    const name = displayName(p.full_name, p.email);
    return { id: p.id, name, first: name.split(" ")[0], email: p.email ?? "" };
  });
  const openTasks = (tasksData?.tasks ?? [])
    .filter((t) => !t.deleted_at && t.status !== "done")
    .map((t) => ({ id: t.id, title: t.title }));

  const emails = (inbox?.threads ?? []).slice(0, 12).map((t) => ({
    ref: t.id,
    messageId: t.id,
    from: t.senderName,
    fromEmail: t.senderEmail,
    subject: t.subject,
  }));

  const now = Date.now();
  const events = (calendar?.events ?? [])
    .filter((e) => e.startDateTime && Date.parse(e.startDateTime) > now - 3_600_000)
    .sort((a, b) => Date.parse(a.startDateTime!) - Date.parse(b.startDateTime!))
    .slice(0, 12)
    .map((e) => ({
      ref: e.id,
      id: e.id,
      title: e.title,
      start: e.startDateTime!,
      end: e.endDateTime ?? e.startDateTime!,
      when: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      }).format(new Date(e.startDateTime!)),
    }));

  return { profiles, openTasks, emails, events, userEmail, userRole: tasksData?.userRole ?? "member" };
}

/* ── Live data summary ─────────────────────────────────────────────────── */

async function buildContext(
  timeZone: string,
  tasksData: TasksData | null,
  directory: Directory,
  inbox: InboxView | null,
  calendar: CalendarData | null,
): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const todayKey = dateKeyInTz(now, timeZone);

  if (tasksData) {
    const { tasks, userId } = tasksData;
    const mine = tasks.filter(
      (t) =>
        !t.deleted_at &&
        t.status !== "done" &&
        (t.created_by === userId || t.assignees.includes(userId ?? "")),
    );
    const overdue = mine.filter((t) => t.due_at && dateKeyInTz(new Date(t.due_at), timeZone) < todayKey);
    const dueToday = mine.filter((t) => t.due_at && dateKeyInTz(new Date(t.due_at), timeZone) === todayKey);
    lines.push(
      `Tasks: ${mine.length} open${overdue.length ? `, ${overdue.length} overdue` : ""}${
        dueToday.length ? `, ${dueToday.length} due today` : ""
      }.`,
    );
    if (overdue.length) lines.push(`Overdue: ${overdue.slice(0, 6).map((t) => t.title).join("; ")}.`);
    if (dueToday.length) lines.push(`Due today: ${dueToday.slice(0, 6).map((t) => t.title).join("; ")}.`);
  }

  if (directory.profiles.length) {
    lines.push(`Team: ${directory.profiles.map((p) => p.name).join(", ")}.`);
  }
  if (directory.openTasks.length) {
    lines.push(`Open tasks: ${directory.openTasks.slice(0, 12).map((t) => t.title).join("; ")}.`);
  }

  if (inbox) {
    lines.push(
      `Inbox: ${inbox.unread} unread, ${inbox.needAttention} needing attention, ${inbox.awaitingReply} awaiting a reply, ${inbox.week} received this week.`,
    );
    if (directory.emails.length) {
      lines.push(
        `Recent emails: ${directory.emails
          .slice(0, 8)
          .map((e) => `${e.from} — ${e.subject}`)
          .join("; ")}.`,
      );
    }
  } else {
    lines.push("Gmail isn't connected, so I have no email data right now.");
  }

  if (calendar) {
    const todays = (calendar.events ?? []).filter(
      (e) => e.isMeeting && meetingDayKey(e, timeZone) === todayKey,
    );
    lines.push(`Calendar today: ${todays.length} meeting${todays.length === 1 ? "" : "s"}.`);
    if (directory.events.length) {
      lines.push(
        `Upcoming events: ${directory.events
          .slice(0, 8)
          .map((e) => `${e.title} (${e.when})`)
          .join("; ")}.`,
      );
    }
  } else {
    lines.push("Calendar isn't connected, so I have no calendar data right now.");
  }

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
