import ModuleHeader from "@/components/ModuleHeader";
import MarketingPlanCard from "@/components/marketing/MarketingPlan";
import { getModule } from "@/lib/modules";
import { getPlan } from "@/lib/marketing/plan-actions";

export const dynamic = "force-dynamic";

export default async function MarketingPlanPage() {
  const m = getModule("marketing")!;
  const plan = await getPlan();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Marketing plan"
        subtitle="Your north star — goals, audience, positioning, pillars, channels and budget."
      />
      <MarketingPlanCard initial={plan} />
    </div>
  );
}
