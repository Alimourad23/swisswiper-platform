"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalEventRaw } from "@/lib/google/calendar";
import { respondToEvent } from "@/lib/google/calendar-actions";
import {
  deviceTimeZone,
  startMs,
  eventDayKey,
  todayKey,
  weekKeys,
  rangeLabel,
  dayLabel,
  timeLabel,
  countdownLabel,
  purposeLine,
  todayLoad,
  formatHours,
  clockLabel,
  type DayLoad,
} from "@/lib/calendar-view";

type DayBucket = { key: string; label: string; meetings: CalEventRaw[]; reminders: CalEventRaw[] };

/* Hand a request to Alfred (summon-anywhere overlay). A seed makes him act/ask
   straight away; no seed just opens him listening. */
function summonAlfred(seed?: string) {
  window.dispatchEvent(
    new CustomEvent("sw-alfred-summon", seed ? { detail: { seed } } : undefined),
  );
}

export default function CalendarBoard({ events }: { events: CalEventRaw[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week; navigates the agenda

  // Establish "now" only after mount (so day/time math uses the device timezone,
  // and the countdown ticks). Avoids any server/client hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const tz = useMemo(() => deviceTimeZone(), []);

  const model = useMemo(() => {
    if (now === null) return null;
    const tKey = todayKey(now);

    const buildDays = (keys: string[]): DayBucket[] => {
      const set = new Set(keys);
      const byDay = new Map<string, { meetings: CalEventRaw[]; reminders: CalEventRaw[] }>();
      for (const e of events) {
        const key = eventDayKey(e);
        if (!set.has(key)) continue;
        const bucket = byDay.get(key) ?? { meetings: [], reminders: [] };
        (e.isMeeting ? bucket.meetings : bucket.reminders).push(e);
        byDay.set(key, bucket);
      }
      return keys.map((key) => {
        const b = byDay.get(key) ?? { meetings: [], reminders: [] };
        b.meetings.sort((a, c) => startMs(a) - startMs(c));
        b.reminders.sort((a, c) => startMs(a) - startMs(c));
        return { key, label: dayLabel(key, tKey), meetings: b.meetings, reminders: b.reminders };
      });
    };

    // Stats are always "this week" (offset 0); the agenda list navigates.
    const days0 = buildDays(weekKeys(now, 0));
    const agendaDays = buildDays(weekKeys(now, weekOffset * 7));

    const todayMeetings = days0[0]?.meetings ?? [];
    const upNext =
      [...events]
        .filter((e) => e.isMeeting && startMs(e) > now)
        .sort((a, b) => startMs(a) - startMs(b))[0] ?? null;

    return {
      agendaDays,
      todayMeetings,
      meetingsToday: todayMeetings.length,
      remindersToday: days0[0]?.reminders.length ?? 0,
      meetingsThisWeek: days0.reduce((n, d) => n + d.meetings.length, 0),
      conflicts: days0.reduce((n, d) => n + d.meetings.filter((m) => m.overlaps).length, 0),
      upNext,
      load: todayLoad(todayMeetings, now),
      tomorrow: days0[1],
      pending: events.filter((e) => e.myStatus === "needsAction"),
    };
  }, [events, now, weekOffset]);

  if (!model || now === null) {
    return (
      <div className="sw-card px-6 py-10 text-center text-sm text-muted">Loading your agenda…</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-hint">Times shown in {tz}</p>
        <button
          type="button"
          onClick={() =>
            summonAlfred("Let's schedule a new meeting — please ask me the title, time, and who to invite.")
          }
          className="shrink-0 rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          + New meeting with Alfred
        </button>
      </div>

      <UpNext ev={model.upNext} now={now} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Meetings today" value={model.meetingsToday} accent />
        <Stat label="Meetings this week" value={model.meetingsThisWeek} />
        <LoadCard load={model.load} conflicts={model.conflicts} />
      </section>

      {model.pending.length > 0 && <PendingInvites items={model.pending} now={now} />}

      {model.tomorrow && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TomorrowCard day={model.tomorrow} />
        </section>
      )}

      <div className="sw-card">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-medium">
              {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : rangeLabel(model.agendaDays.map((d) => d.key))}
            </h3>
            {weekOffset !== 0 && (
              <span className="text-xs text-hint">{rangeLabel(model.agendaDays.map((d) => d.key))}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="mr-1 text-xs font-medium text-peri-deep hover:underline"
              >
                Today
              </button>
            )}
            <NavArrow dir="prev" disabled={weekOffset === 0} onClick={() => setWeekOffset((o) => Math.max(0, o - 1))} />
            <NavArrow dir="next" disabled={weekOffset >= 4} onClick={() => setWeekOffset((o) => Math.min(4, o + 1))} />
          </div>
        </div>
        {model.agendaDays.map((d) => (
          <DayBlock key={d.key} day={d} />
        ))}
      </div>
    </div>
  );
}

function UpNext({ ev, now }: { ev: CalEventRaw | null; now: number }) {
  if (!ev) {
    return (
      <div className="sw-card px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-hint">Up next</p>
        <p className="mt-1 text-sm text-muted">No upcoming meetings.</p>
      </div>
    );
  }
  const purpose = purposeLine(ev);
  return (
    <div className="sw-card flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-hint">Up next</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="truncate text-lg font-medium text-ink">{ev.title}</p>
          {ev.overlaps && <OverlapBadge />}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {timeLabel(ev)} · <span className="font-medium text-peri-deep">{countdownLabel(startMs(ev) - now)}</span>
        </p>
        {purpose && <p className="mt-0.5 truncate text-sm text-hint">{purpose}</p>}
      </div>
      <EventActions ev={ev} />
    </div>
  );
}

function LoadCard({ load, conflicts }: { load: DayLoad; conflicts: number }) {
  const free =
    load.freeStart && load.freeEnd
      ? `free ${clockLabel(load.freeStart)}–${clockLabel(load.freeEnd)}`
      : "no long free block";
  return (
    <div className="sw-card px-6 py-5">
      <span className="text-sm text-muted">Today’s load</span>
      <p className="mt-2 text-sm text-ink">
        {load.meetings} {load.meetings === 1 ? "meeting" : "meetings"} · {formatHours(load.hours)} booked
      </p>
      <p className="mt-0.5 text-sm text-muted">{free}</p>
      {conflicts > 0 && (
        <p className="mt-1 text-sm font-medium text-red-600">
          {conflicts} overlapping {conflicts === 1 ? "meeting" : "meetings"}
        </p>
      )}
    </div>
  );
}

function PendingInvites({ items, now }: { items: CalEventRaw[]; now: number }) {
  const [done, setDone] = useState<Record<string, "accepted" | "declined" | "tentative">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const tKey = todayKey(now);

  async function respond(ev: CalEventRaw, response: "accepted" | "declined" | "tentative") {
    if (busy) return;
    setBusy(ev.id);
    const r = await respondToEvent({ eventId: ev.id, response });
    setBusy(null);
    if (r.ok) setDone((d) => ({ ...d, [ev.id]: response }));
  }

  return (
    <div className="sw-card">
      <div className="border-b border-hairline px-6 py-4">
        <h3 className="text-base font-medium">Invitations awaiting your reply</h3>
      </div>
      <ul>
        {items.map((ev) => {
          const status = done[ev.id];
          const who = ev.attendeesOthers.slice(0, 2).join(", ");
          return (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{ev.title}</p>
                <p className="truncate text-sm text-muted">
                  {dayLabel(eventDayKey(ev), tKey)} · {timeLabel(ev)}
                  {who ? ` · ${who}` : ""}
                </p>
              </div>
              {status ? (
                <span
                  className={[
                    "shrink-0 text-xs font-medium",
                    status === "accepted"
                      ? "text-emerald-600"
                      : status === "declined"
                        ? "text-red-600"
                        : "text-hint",
                  ].join(" ")}
                >
                  {status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Maybe"}
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => respond(ev, "accepted")}
                    disabled={busy === ev.id}
                    className="rounded-full bg-peri-soft px-2.5 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(ev, "tentative")}
                    disabled={busy === ev.id}
                    className="text-xs text-hint transition-colors hover:text-ink hover:underline disabled:opacity-50"
                  >
                    Maybe
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(ev, "declined")}
                    disabled={busy === ev.id}
                    className="text-xs text-hint transition-colors hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TomorrowCard({ day }: { day: DayBucket }) {
  const titles = day.meetings.slice(0, 3).map((m) => m.title).join(", ");
  return (
    <div className="sw-card px-6 py-5">
      <span className="text-sm text-muted">Tomorrow</span>
      <p className="mt-2 text-sm text-ink">
        {day.meetings.length} {day.meetings.length === 1 ? "meeting" : "meetings"}
      </p>
      {day.meetings.length > 0 && (
        <p className="mt-0.5 truncate text-sm text-muted">
          {titles}
          {day.meetings.length > 3 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function DayBlock({ day }: { day: DayBucket }) {
  const empty = day.meetings.length === 0 && day.reminders.length === 0;
  return (
    <div className="border-t border-hairline px-6 py-4 first:border-t-0">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-ink">{day.label}</h4>
        <span className="text-xs text-hint">
          {day.meetings.length} {day.meetings.length === 1 ? "meeting" : "meetings"}
        </span>
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-hint">Nothing scheduled</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {day.meetings.map((m) => (
            <MeetingRow key={m.id} ev={m} />
          ))}
          {day.reminders.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
              {day.reminders.map((r) => (
                <ReminderRow key={r.id} ev={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingRow({ ev }: { ev: CalEventRaw }) {
  const purpose = purposeLine(ev);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <span className="w-20 shrink-0 pt-0.5 text-sm tabular-nums text-muted">{timeLabel(ev)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{ev.title}</span>
            {ev.overlaps && <OverlapBadge />}
          </div>
          {purpose && <p className="truncate text-sm text-muted">{purpose}</p>}
        </div>
      </div>
      <EventActions ev={ev} />
    </div>
  );
}

function ReminderRow({ ev }: { ev: CalEventRaw }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm tabular-nums text-hint">{timeLabel(ev)}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted">{ev.title}</span>
      <ReminderTag />
    </div>
  );
}

function NavArrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous week" : "Next week"}
      className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-bg hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

function EventActions({ ev }: { ev: CalEventRaw }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {ev.joinUrl && <JoinButton url={ev.joinUrl} />}
      <button
        type="button"
        onClick={() =>
          summonAlfred(`I'd like to reschedule my meeting "${ev.title}". Please ask me the new time.`)
        }
        className="text-xs text-hint transition-colors hover:text-peri-deep hover:underline"
      >
        Reschedule
      </button>
      <button
        type="button"
        onClick={() => summonAlfred(`Cancel my meeting "${ev.title}".`)}
        className="text-xs text-hint transition-colors hover:text-red-600 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

function JoinButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-peri-deep px-3.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#4d5793]"
    >
      Join
    </a>
  );
}

function OverlapBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium leading-none text-red-600">
      Overlaps
    </span>
  );
}

function ReminderTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-line px-2 py-0.5 text-[11px] font-medium leading-none text-hint">
      Reminder
    </span>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="sw-card px-6 py-5">
      <span className="text-sm text-muted">{label}</span>
      <p
        className={[
          "mt-2 text-3xl font-medium tracking-tight",
          accent ? "text-peri-deep" : "text-ink",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
