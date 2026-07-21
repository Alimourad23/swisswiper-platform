import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import { AutoTag, ServiceBadge } from "@/components/Pill";
import EngagementBoard from "@/components/marketing/EngagementBoard";
import { channels } from "@/lib/marketing/channels";
import { getEngagementView } from "@/lib/marketing/engagement-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* The engagement inbox — comments + DMs live from Instagram, Alfred drafts in
   the right founder voice, a human approves every send. */

export default function EngagementPage() {
  const icon = channels.find((c) => c.key === "instagram")?.icon;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
  const view = await getEngagementView();

  if (!view.connected) {
    return (
      <div className="sw-card flex flex-col items-start gap-2 p-6">
        <h3 className="text-base font-medium">Instagram isn&apos;t reachable right now</h3>
        <p className="text-sm text-muted">{view.reason}</p>
      </div>
    );
  }

  return (
    <EngagementBoard
      comments={view.comments}
      threads={view.threads}
      commentsError={view.commentsError}
      dmError={view.dmError}
    />
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
