import { Suspense } from "react";
import Link from "next/link";
import ModuleHeader from "@/components/ModuleHeader";
import MarketingOverviewClient from "@/components/marketing/MarketingOverviewClient";
import WeeklyReport from "@/components/marketing/WeeklyReport";
import AiUsageCard from "@/components/marketing/AiUsageCard";
import { getModule } from "@/lib/modules";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getPlan } from "@/lib/marketing/plan-actions";
import { getUsageSummary } from "@/lib/marketing/ai-usage-actions";
import { getInstagramLite } from "@/lib/marketing/instagram-data";

export const dynamic = "force-dynamic";

export default function MarketingPage() {
  const m = getModule("marketing")!;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Executive summary and performance. Plan and Calendar live in the menu."
        right={<span className="text-xs text-hint">Live channels: LinkedIn · Instagram</span>}
      />
      <Suspense fallback={<MetricsSkeleton />}>
        <MarketingData />
      </Suspense>
    </div>
  );
}

async function MarketingData() {
  const [{ metrics }, posts, plan, usage, instagram] = await Promise.all([
    getLinkedInMetrics(),
    getContentPosts(),
    getPlan(),
    getUsageSummary(),
    getInstagramLite(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/marketing/plan"
          className="rounded-full bg-peri-soft px-4 py-1.5 text-sm font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          Marketing plan →
        </Link>
        <Link
          href="/dashboard/marketing/pipeline"
          className="rounded-full bg-peri-soft px-4 py-1.5 text-sm font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          Pipeline →
        </Link>
        <Link
          href="/dashboard/marketing/calendar"
          className="rounded-full bg-peri-soft px-4 py-1.5 text-sm font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          Content calendar →
        </Link>
      </div>
      <WeeklyReport metrics={metrics} posts={posts} goal={plan.goals} />
      <AiUsageCard usage={usage} />
      <MarketingOverviewClient metrics={metrics} instagram={instagram} />
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
