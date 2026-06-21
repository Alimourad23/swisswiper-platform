"use server";

import { getGoogleAccessToken } from "@/lib/google/tokens";

/* Calendar WRITE actions for Alfred — create / reschedule / cancel events on the
   user's primary calendar. The client gates each behind explicit confirmation;
   cancel needs a clear confirm. Token fetched server-side, never exposed. */

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* Accepts "YYYY-MM-DDTHH:mm" (datetime-local) or a fuller ISO; returns RFC3339
   local wall-clock (no offset) — paired with timeZone, Google interprets it
   in that zone. */
function toDateTime(s: string): string {
  const t = (s || "").trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/);
  if (m) return `${m[1]}T${m[2]}${m[3] ?? ":00"}`;
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return "";
  // Fallback: format the parsed instant as local wall-clock.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours(),
  )}:${pad(parsed.getMinutes())}:00`;
}

export async function createEvent(input: {
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  timeZone: string;
}): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  const start = toDateTime(input.start);
  const end = toDateTime(input.end);
  if (!input.title?.trim()) return { ok: false, error: "a title is needed." };
  if (!start || !end) return { ok: false, error: "a valid start and end time are needed." };

  const body = {
    summary: input.title.trim(),
    description: input.description?.trim() || undefined,
    start: { dateTime: start, timeZone: input.timeZone },
    end: { dateTime: end, timeZone: input.timeZone },
    attendees: (input.attendees ?? [])
      .map((e) => e.trim())
      .filter((e) => e.includes("@"))
      .map((email) => ({ email })),
  };

  const res = await fetch(CAL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Calendar create failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Calendar returned ${res.status}.` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id };
}

export async function rescheduleEvent(input: {
  eventId: string;
  start: string;
  end: string;
  timeZone: string;
}): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  const start = toDateTime(input.start);
  const end = toDateTime(input.end);
  if (!start || !end) return { ok: false, error: "a valid new time is needed." };

  const res = await fetch(`${CAL}/${encodeURIComponent(input.eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      start: { dateTime: start, timeZone: input.timeZone },
      end: { dateTime: end, timeZone: input.timeZone },
    }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Calendar reschedule failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Calendar returned ${res.status}.` };
  }
  return { ok: true };
}

export async function cancelEvent(input: { eventId: string }): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  const res = await fetch(`${CAL}/${encodeURIComponent(input.eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 204 No Content on success; 410 means already gone (treat as ok).
  if (!res.ok && res.status !== 410) {
    // eslint-disable-next-line no-console
    console.error("Calendar cancel failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Calendar returned ${res.status}.` };
  }
  return { ok: true };
}
