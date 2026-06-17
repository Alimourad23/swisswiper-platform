import type { ReactNode } from "react";
import Link from "next/link";
import AlfredOrb from "@/components/AlfredOrb";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { LivePill, SoonPill, ServiceBadge } from "@/components/Pill";
import { icons } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const fullName = meta.full_name ?? meta.name ?? user?.email ?? "";
  const firstName = fullName.split(" ")[0] || "there";

  // Live Gmail view (null until Google is connected with Gmail access).
  const token = await getGoogleAccessToken();
  let gmail: InboxView | null = null;
  if (token) {
    try {
      gmail = await getInboxView(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Gmail view failed:", e);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Hero */}
      <section className="sw-card flex flex-col items-start justify-between gap-8 px-7 py-8 sm:flex-row sm:items-center sm:px-9">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            Good morning, {firstName}
          </h1>
          <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
            Your command center. Everything that matters, in one calm place.
          </p>
        </div>
        <AlfredOrb firstName={firstName} />
      </section>

      {/* KPI row — honest: no fake numbers until connected */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Unread email" value={gmail?.unread} />
        <KpiCard label="Meetings today" />
        <KpiCard label="Response time" />
        <KpiCard label="Focus hours" />
      </section>

      {/* Two live panels */}
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
          {gmail ? (
            <div className="py-5">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Unread" value={gmail.unread} />
                <MiniStat label="This week" value={gmail.week} />
                <MiniStat label="Attention" value={gmail.needAttention} />
              </div>
              <Link
                href="/dashboard/emails"
                className="mt-5 inline-block text-sm font-medium text-peri-deep hover:underline"
              >
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

function KpiCard({ label, value }: { label: string; value?: number }) {
  const hasValue = value !== undefined && value !== null;
  return (
    <div className="sw-card flex flex-col gap-3 px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {!hasValue && <SoonPill />}
      </div>
      <span
        className={[
          "text-3xl font-medium tracking-tight",
          hasValue ? "text-ink" : "text-hint",
        ].join(" ")}
      >
        {hasValue ? value : "—"}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-bg px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
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
