import type { ReactNode } from "react";
import AlfredOrb from "@/components/AlfredOrb";
import ConnectState from "@/components/ConnectState";
import { LivePill, SoonPill, ServiceBadge } from "@/components/Pill";
import { icons } from "@/lib/modules";

export default function OverviewPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Hero */}
      <section className="sw-card flex flex-col items-start justify-between gap-8 px-7 py-8 sm:flex-row sm:items-center sm:px-9">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Good morning, Ali</h1>
          <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
            Your command center. Everything that matters, in one calm place.
          </p>
        </div>
        <AlfredOrb />
      </section>

      {/* KPI row — honest: no fake numbers until connected */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Unread email" />
        <KpiCard label="Meetings today" />
        <KpiCard label="Response time" />
        <KpiCard label="Focus hours" />
      </section>

      {/* Two live panels with ready/connect states */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Email triage"
          badges={
            <>
              <LivePill />
              <ServiceBadge label="Gmail" />
            </>
          }
        >
          <ConnectState
            icon={icons.emails}
            message="Connect Gmail to see your triaged inbox — what needs a reply, what can wait, and what to ignore."
            ctaLabel="Connect Gmail"
          />
        </Panel>

        <Panel
          title="Today"
          badges={
            <>
              <LivePill />
              <ServiceBadge label="Google Calendar" />
            </>
          }
        >
          <ConnectState
            icon={icons.calendar}
            message="Connect Google Calendar to see today's agenda and your meeting load at a glance."
            ctaLabel="Connect Calendar"
          />
        </Panel>
      </section>

      {/* Modules connecting soon */}
      <section>
        <h2 className="px-1 pb-3 text-sm font-medium text-muted">Modules connecting soon</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SoonTile name="Marketing" icon={icons.marketing} />
          <SoonTile name="Sales" icon={icons.sales} />
          <SoonTile name="Orders" icon={icons.orders} />
          <SoonTile name="Finance" icon={icons.finance} />
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label }: { label: string }) {
  return (
    <div className="sw-card flex flex-col gap-3 px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <SoonPill />
      </div>
      <span className="text-3xl font-medium tracking-tight text-hint">—</span>
    </div>
  );
}

function Panel({
  title,
  badges,
  children,
}: {
  title: string;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sw-card flex flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <h3 className="text-base font-medium">{title}</h3>
        <div className="flex items-center gap-2">{badges}</div>
      </div>
      <div className="px-6">{children}</div>
    </div>
  );
}

function SoonTile({ name, icon }: { name: string; icon: ReactNode }) {
  return (
    <div className="sw-soon flex flex-col gap-6 px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] bg-surface/70 text-peri-deep">
          {icon}
        </span>
        <SoonPill />
      </div>
      <span className="text-sm font-medium text-ink">{name}</span>
    </div>
  );
}
