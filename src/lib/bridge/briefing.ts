/* Pure, timezone-aware composer for Alfred's spoken briefing on The Bridge.
   Runs on the CLIENT so "today", overdue/due-today and the greeting all follow
   the viewer's device timezone. The server hands over raw facts only. */

import type { CalEventRaw } from "@/lib/google/calendar";
import { eventDayKey, todayKey, startMs, timeLabel } from "@/lib/calendar-view";

export type BridgeData = {
  firstName: string;
  gmail: { unread: number; needAttention: number; awaitingReply: number } | null;
  events: CalEventRaw[] | null;
  myOpenTasks: number;
  myTaskDueDates: (string | null)[];
  marketing: {
    totalAudience: number;
    linkedin: { followers: number; engagementRatePct: number };
    instagram: { followers: number } | null;
  } | null;
};

export type BriefingMode = "full" | "short";

export type Briefing = {
  greeting: string; // "Good evening, Ali"
  synthesis: string; // one calm/busy line (full) or "How may I be of assistance?" (short)
  lines: string[]; // the few specifics — empty in short mode
  spoken: string; // the full text Alfred speaks aloud
  mode: BriefingMode;
};

export function partOfDay(now: number): "morning" | "afternoon" | "evening" {
  const h = new Date(now).getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isOverdue(iso: string | null, now: number): boolean {
  if (!iso) return false;
  return Date.parse(iso) < startOfDay(now);
}

function isDueToday(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

const plural = (n: number) => (n === 1 ? "" : "s");

export function composeBriefing(
  data: BridgeData,
  now: number,
  mode: BriefingMode = "full",
): Briefing {
  const part = partOfDay(now);
  const greeting = `Good ${part}, ${data.firstName}`;

  // SHORT — returning soon after, during active work. Just a warm greeting,
  // no status lines and no long read.
  if (mode === "short") {
    return {
      greeting,
      synthesis: "How may I be of assistance?",
      lines: [],
      spoken: `${greeting}. How may I be of assistance?`,
      mode: "short",
    };
  }

  // ── Calendar ──────────────────────────────────────────────────────────
  let meetingLine: string | null = null;
  let meetingsToday = 0;
  if (data.events) {
    const tKey = todayKey(now);
    meetingsToday = data.events.filter((e) => e.isMeeting && eventDayKey(e) === tKey).length;
    const nextUpcoming = data.events
      .filter((e) => e.isMeeting && startMs(e) > now)
      .sort((a, b) => startMs(a) - startMs(b))[0];
    const nextToday = nextUpcoming && eventDayKey(nextUpcoming) === tKey ? nextUpcoming : null;

    if (meetingsToday === 0) {
      meetingLine = "Nothing on your calendar today";
    } else {
      meetingLine = `${meetingsToday} meeting${plural(meetingsToday)} today`;
      if (nextToday) meetingLine += ` — next is ${nextToday.title} at ${timeLabel(nextToday)}`;
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────
  let emailLine: string | null = null;
  if (data.gmail) {
    const { unread, needAttention, awaitingReply } = data.gmail;
    if (unread === 0) {
      emailLine = "Your inbox is clear";
    } else {
      emailLine = `${unread} unread email${plural(unread)}`;
      const extra: string[] = [];
      if (needAttention > 0) extra.push(`${needAttention} need${needAttention === 1 ? "s" : ""} attention`);
      if (awaitingReply > 0) extra.push(`${awaitingReply} awaiting your reply`);
      if (extra.length) emailLine += ` — ${extra.join(", ")}`;
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────
  const overdue = data.myTaskDueDates.filter((d) => isOverdue(d, now)).length;
  const dueToday = data.myTaskDueDates.filter((d) => isDueToday(d, now)).length;
  let taskLine: string;
  if (data.myOpenTasks === 0) {
    taskLine = "No open tasks";
  } else {
    taskLine = `${data.myOpenTasks} open task${plural(data.myOpenTasks)}`;
    const extra: string[] = [];
    if (overdue > 0) extra.push(`${overdue} overdue`);
    if (dueToday > 0) extra.push(`${dueToday} due today`);
    if (extra.length) taskLine += ` — ${extra.join(", ")}`;
  }

  // ── Marketing pulse (LinkedIn + Instagram) ────────────────────────────
  let marketingLine: string | null = null;
  if (data.marketing) {
    const m = data.marketing;
    const eng = m.linkedin.engagementRatePct.toFixed(1);
    if (m.instagram) {
      marketingLine = `Audience — ${m.linkedin.followers.toLocaleString()} on LinkedIn, ${m.instagram.followers.toLocaleString()} on Instagram; ${eng}% LinkedIn engagement`;
    } else {
      marketingLine = `LinkedIn — ${m.linkedin.followers.toLocaleString()} followers at ${eng}% engagement`;
    }
  }

  const lines = [meetingLine, emailLine, taskLine, marketingLine].filter(
    (l): l is string => Boolean(l),
  );

  // ── Synthesis ─────────────────────────────────────────────────────────
  const inboxCalm = data.gmail ? data.gmail.unread === 0 : true;
  const calmDay = meetingsToday === 0 && inboxCalm && data.myOpenTasks === 0;
  const pressure =
    (meetingsToday >= 3 ? 1 : 0) + overdue + (data.gmail?.needAttention ?? 0);

  let synthesis: string;
  if (calmDay) {
    synthesis = "Everything's calm — nothing needs your attention right now.";
  } else if (pressure >= 3) {
    synthesis = `A full ${part} ahead. Here's what matters.`;
  } else {
    synthesis = `A steady ${part}. Here's where things stand.`;
  }

  // ── Spoken text ───────────────────────────────────────────────────────
  // Full briefing opens with Alfred introducing himself, then the updates.
  const spoken = [
    `${greeting}. This is Alfred, your personal assistant on the SwissWiper platform.`,
    synthesis,
    ...lines.map((l) => `${l.replace(/ — /g, ", ")}.`),
    "I'm here if you need me.",
  ].join(" ");

  return { greeting, synthesis, lines, spoken, mode: "full" };
}
