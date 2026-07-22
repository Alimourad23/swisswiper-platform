import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import AlfredOrb from "@/components/AlfredOrb";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { icons } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";
import { getCalendarData } from "@/lib/google/calendar";
import OverviewToday from "@/components/calendar/OverviewToday";
import MeetingsTodayKpi from "@/components/calendar/MeetingsTodayKpi";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg, decisionMakerShare } from "@/lib/linkedin/compute";
import { getTasksData } from "@/lib/tasks/data";
import TasksPulse from "@/components/tasks/TasksPulse";
import DashboardToday from "@/components/tasks/DashboardToday";

export const dynamic = "force-dynamic";

/* Compact command-center home — same tight-square / small-type language as the
   marketing cockpit. Data-heavy sections stream in via Suspense. */
export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const fullName = meta.full_name ?? meta.name ?? user?.email ?? "";
  const firstName = fullName.split(" ")[0] || "there";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      {/* Hero — instant */}
      <section className="sw-card flex flex-col items-start justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[20px] font-medium tracking-tight">Good morning, {firstName}</h1>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
            Your command center — everything that matters, in one calm place.
          </p>
        </div>
        <AlfredOrb firstName={firstName} />
      </section>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewBody firstName={firstName} />
      </Suspense>
    </div>
  );
}

async function OverviewBody({ firstName }: { firstName: string }) {
  const token = await getGoogleAccessToken();
  const [gmail, calendar, liResult, tasksResult] = await Promise.all([
    token ? getInboxView(token).catch(() => null) : Promise.resolve<InboxView | null>(null),
    token ? getCalendarData(token).catch(() => null) : Promise.resolve(null),
    getLinkedInMetrics(),
    getTasksData(),
  ]);

  const li = liResult.metrics;
  const liAgg = windowAgg(li, 365);
  const liDm = decisionMakerShare(li);
  const { tasks, userId } = tasksResult;

  return (
    <>
      {/* ── 01 Today ── */}
      <section className="flex flex-col gap-3">
        <SectionHead n="01" title="Today" note="your day at a glance" />
        <Panel title="Today's plan" badges={<><LivePill /><ServiceBadge label="Alfred" /></>}>
          <DashboardToday tasks={tasks} userId={userId} firstName={firstName} />
        </Panel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Unread email" value={gmail?.unread} />
          {calendar ? <MeetingsTodayKpi events={calendar.events} /> : <KpiCard label="Meetings today" />}
          <KpiCard label="Response time" />
          <KpiCard label="Focus hours" />
        </div>
      </section>

      {/* ── 02 Inbox & calendar ── */}
      <section className="flex flex-col gap-3">
        <SectionHead n="02" title="Inbox & calendar" note="Gmail and your agenda" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Email triage" badges={<><LivePill /><ServiceBadge label="Gmail" /></>}>
          {gmail ? (
            <div className="py-3.5">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Unread" value={gmail.unread} />
                <MiniStat label="This week" value={gmail.week} />
                <MiniStat label="Attention" value={gmail.needAttention} />
              </div>
              <Link href="/dashboard/emails" className="mt-3.5 inline-block text-[12px] font-medium text-peri-deep hover:underline">
                View triaged inbox →
              </Link>
            </div>
          ) : (
            <ConnectState
              icon={icons.emails}
              message="Connect your Google account with read-only Gmail access to see your triaged inbox."
              action={<GoogleAuthButton variant="inline" label="Connect Gmail access" />}
            />
          )}
        </Panel>

        <Panel title="Today" badges={<><LivePill /><ServiceBadge label="Google Calendar" /></>}>
          {calendar ? (
            <OverviewToday events={calendar.events} />
          ) : (
            <ConnectState
              icon={icons.calendar}
              message="Connect your Google account with read-only Calendar access to see today's agenda."
              action={<GoogleAuthButton variant="inline" label="Connect Calendar access" />}
            />
          )}
        </Panel>
        </div>
      </section>

      {/* ── 03 Team & marketing ── */}
      <section className="flex flex-col gap-3">
        <SectionHead n="03" title="Team & marketing" note="tasks and channel pulse" />
        <Panel title="Tasks pulse" badges={<><LivePill /><ServiceBadge label="Team" /></>}>
          <TasksPulse tasks={tasks} userId={userId} />
        </Panel>
        <Panel title="Marketing pulse" badges={<><LivePill /><ServiceBadge label="LinkedIn" /></>}>
          <div className="py-3.5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Audience" value={li.followersAllTime.toLocaleString("en-US")} />
              <MiniStat label="Reach" value={liAgg.impressions.toLocaleString("en-US")} />
              <MiniStat label="Engagement rate" value={(liAgg.engagementRate * 100).toFixed(1) + "%"} />
              <MiniStat label="Decision-maker share" value={(liDm.pct * 100).toFixed(0) + "%"} />
            </div>
            <Link href="/dashboard/marketing" className="mt-3.5 inline-block text-[12px] font-medium text-peri-deep hover:underline">
              View Marketing →
            </Link>
          </div>
        </Panel>
      </section>
    </>
  );
}

function SectionHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-hairline px-1 pb-1.5">
      <span className="text-[10px] font-bold tracking-[0.14em] text-peri-deep">{n}</span>
      <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
      {note ? <span className="text-[11px] text-muted">— {note}</span> : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sw-card h-20 animate-pulse" />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="sw-card h-48 animate-pulse" />
        <div className="sw-card h-48 animate-pulse" />
      </section>
      <div className="sw-card h-36 animate-pulse" />
    </>
  );
}

function KpiCard({ label, value }: { label: string; value?: number }) {
  const hasValue = value !== undefined && value !== null;
  return (
    <div className="sw-card flex flex-col gap-1.5 px-4 py-3">
      <span className="text-[11px] text-hint">{label}</span>
      <span className={["text-[20px] font-medium tracking-tight", hasValue ? "text-ink" : "text-hint"].join(" ")}>
        {hasValue ? value : "—"}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-bg px-3 py-2.5">
      <span className="text-[10px] text-hint">{label}</span>
      <p className="mt-0.5 text-[18px] font-medium tracking-tight">{value}</p>
    </div>
  );
}

function Panel({ title, badges, children }: { title: string; badges?: ReactNode; children: ReactNode }) {
  return (
    <div className="sw-card flex flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <h3 className="text-[13px] font-medium">{title}</h3>
        <div className="flex items-center gap-2">{badges}</div>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}
