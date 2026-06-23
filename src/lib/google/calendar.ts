/* Google Calendar REST helpers — STRICTLY READ-ONLY.
   Only GET requests. Nothing here can create, edit, move, or delete events.

   This module does NOT decide "today" or format times — those depend on the
   viewer's device timezone and are handled on the client. Here we only fetch
   raw events (with absolute timestamps) and compute timezone-independent
   facts: meeting vs reminder, join links, overlaps, and pending invites. */

const CAL = "https://www.googleapis.com/calendar/v3";

async function cget<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${CAL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Calendar GET ${path} -> ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export type MyStatus = "needsAction" | "accepted" | "declined" | "tentative" | "none";

export type CalEventRaw = {
  id: string;
  title: string;
  startDateTime: string | null; // ISO instant for timed events
  endDateTime: string | null;
  allDayStart: string | null; // "YYYY-MM-DD" for all-day events (no timezone)
  allDayEnd: string | null;
  isMeeting: boolean; // has another attendee OR a video link
  attendeesOthers: string[]; // display names/emails of other attendees
  location: string;
  purpose: string; // trimmed plain-text description
  joinUrl: string | null; // Meet / Zoom / Teams link
  myStatus: MyStatus;
  overlaps: boolean; // overlaps another meeting (set below)
};

type GEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  hangoutLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: {
    self?: boolean;
    resource?: boolean;
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

export async function getCalendarData(
  token: string,
): Promise<{ events: CalEventRaw[]; pendingInvites: number }> {
  const now = Date.now();
  const params = new URLSearchParams({
    singleEvents: "true", // expand recurring events
    orderBy: "startTime",
    maxResults: "250",
    timeMin: new Date(now - 24 * 3600 * 1000).toISOString(),
    timeMax: new Date(now + 35 * 24 * 3600 * 1000).toISOString(),
  });

  const data = await cget<{ items?: GEvent[] }>(
    token,
    "/calendars/primary/events?" + params.toString(),
  );

  const events = (data.items ?? [])
    .filter((ev) => ev.status !== "cancelled")
    .map(mapEvent)
    .filter((ev) => ev.myStatus !== "declined");

  // Flag overlapping meetings (timezone-independent, based on absolute instants).
  const timedMeetings = events.filter((e) => e.isMeeting && e.startDateTime && e.endDateTime);
  for (let i = 0; i < timedMeetings.length; i++) {
    for (let j = i + 1; j < timedMeetings.length; j++) {
      const a = timedMeetings[i];
      const b = timedMeetings[j];
      const aStart = Date.parse(a.startDateTime!);
      const aEnd = Date.parse(a.endDateTime!);
      const bStart = Date.parse(b.startDateTime!);
      const bEnd = Date.parse(b.endDateTime!);
      if (aStart < bEnd && bStart < aEnd) {
        a.overlaps = true;
        b.overlaps = true;
      }
    }
  }

  const pendingInvites = events.filter((e) => e.myStatus === "needsAction").length;
  return { events, pendingInvites };
}

function mapEvent(ev: GEvent): CalEventRaw {
  const others = (ev.attendees ?? [])
    .filter((a) => !a.self && !a.resource)
    .map((a) => a.displayName || a.email || "")
    .filter(Boolean);

  const joinUrl = getJoinUrl(ev);
  const me = ev.attendees?.find((a) => a.self);
  const myStatus = (me?.responseStatus as MyStatus) ?? "none";

  return {
    id: ev.id ?? Math.random().toString(36).slice(2),
    title: ev.summary || "(no title)",
    startDateTime: ev.start?.dateTime ?? null,
    endDateTime: ev.end?.dateTime ?? null,
    allDayStart: ev.start?.date ?? null,
    allDayEnd: ev.end?.date ?? null,
    isMeeting: others.length > 0 || !!joinUrl,
    attendeesOthers: others,
    location: ev.location ?? "",
    purpose: sanitize(ev.description ?? ""),
    joinUrl,
    myStatus,
    overlaps: false,
  };
}

function getJoinUrl(ev: GEvent): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  const video = ev.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri,
  );
  if (video?.uri) return video.uri;
  const text = `${ev.location ?? ""} ${ev.description ?? ""}`;
  const m = text.match(
    /https?:\/\/[^\s<>"]*(zoom\.us|teams\.microsoft\.com|meet\.google\.com)[^\s<>"]*/i,
  );
  return m ? m[0] : null;
}

function sanitize(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ") // strip tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 140 ? text.slice(0, 139).trimEnd() + "…" : text;
}
