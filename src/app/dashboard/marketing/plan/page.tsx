import ModuleHeader from "@/components/ModuleHeader";
import MarketingPlanCard from "@/components/marketing/MarketingPlan";
import OkrEditor from "@/components/marketing/OkrEditor";
import { getModule } from "@/lib/modules";
import { getPlan } from "@/lib/marketing/plan-actions";
import { getOkrs } from "@/lib/marketing/okr-actions";

export const dynamic = "force-dynamic";

export default async function MarketingPlanPage() {
  const m = getModule("marketing")!;
  const [plan, okrs] = await Promise.all([getPlan(), getOkrs()]);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader
        icon={m.icon}
        title="Marketing plan"
        subtitle="Your north star — objectives, targets, positioning, pillars and budget."
      />
      <OkrEditor initial={okrs} />
      <MarketingPlanCard initial={plan} />
    </div>
  );
}
