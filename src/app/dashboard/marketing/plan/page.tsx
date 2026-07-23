import ModuleHeader from "@/components/ModuleHeader";
import MarketingPlanCard from "@/components/marketing/MarketingPlan";
import OkrEditor from "@/components/marketing/OkrEditor";
import AiUsageCard from "@/components/marketing/AiUsageCard";
import { getModule } from "@/lib/modules";
import { getPlan } from "@/lib/marketing/plan-actions";
import { getOkrs } from "@/lib/marketing/okr-actions";
import { getUsageSummary } from "@/lib/marketing/ai-usage-actions";
import { canEditModule } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function MarketingPlanPage() {
  const m = getModule("marketing")!;
  const [plan, okrs, usage, canEdit] = await Promise.all([getPlan(), getOkrs(), getUsageSummary(), canEditModule("marketing")]);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader
        icon={m.icon}
        title="Marketing plan"
        subtitle="Your north star — objectives, targets, positioning, pillars and budget."
      />
      <OkrEditor initial={okrs} canEdit={canEdit} />
      <AiUsageCard usage={usage} />
      <MarketingPlanCard initial={plan} canEdit={canEdit} />
    </div>
  );
}
