"use server";

import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";

/* Marketing content → Google Calendar sync.

   When a post is scheduled, we mirror it onto the user's primary Google Calendar
   as a small set of events that guide the work up to the post date:
     • Plan block    — 3 days before, 10:00–10:30 (timed)
     • Draft block   — 2 days before, 10:00–11:00 (timed)
     • Draft ready   — 1 day before (all-day reminder)
     • Publish today — on the date (all-day announcement, copy in the notes)

   Every event is marked `transparency: "transparent"` (shows as Free) so it never
   blocks the user from scheduling calls — these are guides, not commitments.
   Past-dated events are skipped. Event IDs are stored on the post so a reschedule
   deletes the old set and recreates it (no duplicates), and a delete cleans up. */

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type SyncResult = { ok: boolean; ids: string[]; error?: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
// Add `delta` days to a YYYY-MM-DD date string (UTC math, date-only — no tz drift).
function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

async function deleteEvents(token: string, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      fetch(`${CAL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined),
    ),
  );
}

type Spec =
  | { kind: "allday"; date: string; summary: string; description?: string }
  | { kind: "timed"; date: string; start: string; end: string; summary: string; description?: string };

async function createEvent(token: string, postId: string, timeZone: string, s: Spec): Promise<string | null> {
  const base = {
    summary: s.summary,
    description: s.description || undefined,
    transparency: "transparent" as const,
    extendedProperties: { private: { swPost: postId } },
  };
  const body =
    s.kind === "allday"
      ? { ...base, start: { date: s.date }, end: { date: addDays(s.date, 1) } }
      : {
          ...base,
          start: { dateTime: `${s.date}T${s.start}:00`, timeZone },
          end: { dateTime: `${s.date}T${s.end}:00`, timeZone },
        };
  const res = await fetch(CAL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return data.id ?? null;
}

/* Sync (or re-sync) a single post's calendar events. Pass the post's current
   fields so we don't depend on a just-written DB row. Returns the new event IDs. */
export async function syncPostCalendar(input: {
  postId: string;
  scheduledFor: string | null;
  title: string;
  channel: string;
  body: string;
  timeZone: string;
  /** The viewer's local "today" (YYYY-MM-DD) — used to skip past events. */
  todayStr: string;
}): Promise<SyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, ids: [], error: "Not signed in." };

  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, ids: [], error: "Google isn't connected." };

  // Remove any existing events for this post first.
  const { data: row } = await supabase
    .from("content_posts")
    .select("gcal_event_ids")
    .eq("id", input.postId)
    .single();
  const existing = ((row as { gcal_event_ids?: string[] } | null)?.gcal_event_ids ?? []).filter(Boolean);
  if (existing.length) await deleteEvents(token, existing);

  const date = input.scheduledFor;
  // Unscheduled (or published-without-date): clear and stop.
  if (!date) {
    await supabase.from("content_posts").update({ gcal_event_ids: [] }).eq("id", input.postId);
    return { ok: true, ids: [] };
  }

  const title = input.title.trim() || "Untitled post";
  const ch = input.channel ? ` (${input.channel})` : "";
  const today = input.todayStr;

  const allSpecs: Spec[] = [
    { kind: "timed", date: addDays(date, -3), start: "10:00", end: "10:30", summary: `🧭 Plan: ${title}${ch}` },
    { kind: "timed", date: addDays(date, -2), start: "10:00", end: "11:00", summary: `✍️ Draft: ${title}${ch}` },
    { kind: "allday", date: addDays(date, -1), summary: `✍️ Draft ready: ${title}${ch}` },
    {
      kind: "allday",
      date,
      summary: `📣 Publish today: ${title}${ch}`,
      description: input.body?.trim() || undefined,
    },
  ];
  const specs = allSpecs.filter((s) => s.date >= today); // skip anything already in the past

  const created: string[] = [];
  for (const s of specs) {
    const id = await createEvent(token, input.postId, input.timeZone, s);
    if (id) created.push(id);
  }

  await supabase.from("content_posts").update({ gcal_event_ids: created }).eq("id", input.postId);
  return { ok: true, ids: created };
}

/* Remove a post's calendar events (used before deleting the post). */
export async function clearPostCalendar(postId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const token = await getGoogleAccessToken();
  const { data: row } = await supabase
    .from("content_posts")
    .select("gcal_event_ids")
    .eq("id", postId)
    .single();
  const existing = ((row as { gcal_event_ids?: string[] } | null)?.gcal_event_ids ?? []).filter(Boolean);
  if (token && existing.length) await deleteEvents(token, existing);
  await supabase.from("content_posts").update({ gcal_event_ids: [] }).eq("id", postId);
  return { ok: true };
}
