import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import SectionHead from "@/components/SectionHead";
import { AutoTag, ServiceBadge } from "@/components/Pill";
import EngagementBoard from "@/components/marketing/EngagementBoard";
import AutomationSettings from "@/components/marketing/AutomationSettings";
import { channels } from "@/lib/marketing/channels";
import { getEngagementView } from "@/lib/marketing/engagement-data";
import { getAutomationPolicy } from "@/lib/marketing/automation-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* The engagement inbox — comments + DMs live from Instagram, Alfred drafts in
   the right founder voice, a human approves every send. The automation policy
   sets which safe categories may graduate to auto. */

export default function EngagementPage() {
  const icon = channels.find((c) => c.key === "instagram")?.icon;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader
        icon={icon}
        title="Engagement"
        subtitle="Comments and messages on @swisswiper — Alfred drafts, you approve, nothing sends itself."
        right={
          <div className="flex items-center gap-2">
            <AutoTag label="Live API" />
            <ServiceBadge label="Instagram" />
          </div>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <EngagementData />
      </Suspense>
    </div>
  );
}

async function EngagementData() {
  const [view, policy] = await Promise.all([getEngagementView(), getAutomationPolicy()]);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <SectionHead n="01" title="Automation" note="what Alfred may send on his own" />
        <AutomationSettings initial={policy} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead n="02" title="Inbox" note="comments & messages — you approve each send" />
        {view.connected ? (
          <EngagementBoard
            comments={view.comments}
            threads={view.threads}
            commentsError={view.commentsError}
            dmError={view.dmError}
          />
        ) : (
          <div className="sw-card flex flex-col items-start gap-2 p-6">
            <h3 className="text-[14px] font-medium">Instagram isn&apos;t reachable right now</h3>
            <p className="text-sm text-muted">{view.reason}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="sw-card h-56 animate-pulse" />
      <div className="sw-card h-56 animate-pulse" />
    </div>
  );
}
