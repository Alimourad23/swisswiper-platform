import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import MarketingOverviewClient from "@/components/marketing/MarketingOverviewClient";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import MarketingPlanCard from "@/components/marketing/MarketingPlan";
import { getModule } from "@/lib/modules";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getPlan } from "@/lib/marketing/plan-actions";

export const dynamic = "force-dynamic";

export default function MarketingPage() {
  const m = getModule("marketing")!;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Plan, schedule and measure your content. LinkedIn analytics are live."
        right={<span className="text-xs text-hint">1 of 5 channels connected</span>}
      />
      <Suspense fallback={<MetricsSkeleton />}>
        <MarketingData />
      </Suspense>
    </div>
  );
}

async function MarketingData() {
  const [{ metrics }, posts, plan] = await Promise.all([
    getLinkedInMetrics(),
    getContentPosts(),
    getPlan(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <MarketingPlanCard initial={plan} />
      <ContentSchedule initialPosts={posts} />
      <MarketingOverviewClient metrics={metrics} />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sw-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="sw-card h-64 animate-pulse" />
    </div>
  );
}
