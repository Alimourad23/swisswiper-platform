"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalEventRaw } from "@/lib/google/calendar";
import { eventDayKey, todayKey } from "@/lib/calendar-view";

/* KPI card for "Meetings today", computed in the viewer's device timezone.
   Matches the styling of the server-rendered KpiCard on the Overview. */
export default function MeetingsTodayKpi({ events }: { events: CalEventRaw[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const count = useMemo(() => {
    if (now === null) return null;
    const tKey = todayKey(now);
    return events.filter((e) => e.isMeeting && eventDayKey(e) === tKey).length;
  }, [events, now]);

  return (
    <div className="sw-card flex flex-col gap-3 px-6 py-5">
      <span className="text-sm text-muted">Meetings today</span>
      <span className="text-3xl font-medium tracking-tight text-ink">{count ?? "—"}</span>
    </div>
  );
}
