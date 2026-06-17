import ModuleHeader from "@/components/ModuleHeader";
import MarketingOverviewClient from "@/components/marketing/MarketingOverviewClient";
import { getModule } from "@/lib/modules";
import { getLinkedInMetrics } from "@/lib/linkedin/data";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const m = getModule("marketing")!;
  const { metrics } = await getLinkedInMetrics();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Channel performance. LinkedIn is live; other channels connect over time."
        right={<span className="text-xs text-hint">1 of 5 channels connected</span>}
      />
      <MarketingOverviewClient metrics={metrics} />
    </div>
  );
}
