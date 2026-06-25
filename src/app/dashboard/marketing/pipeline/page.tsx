import ModuleHeader from "@/components/ModuleHeader";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import PlannerTabs from "@/components/marketing/PlannerTabs";
import { getModule } from "@/lib/modules";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getMonthPlan } from "@/lib/marketing/monthly-actions";
import { monthKey } from "@/lib/marketing/monthly";

export const dynamic = "force-dynamic";

export default async function MarketingPipelinePage() {
  const m = getModule("marketing")!;
  const key = monthKey(); // next month
  const [posts, monthPlan] = await Promise.all([getContentPosts(), getMonthPlan(key)]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Pipeline"
        subtitle="Every post from idea to published — plan, queue and open the Studio to draft."
      />
      <PlannerTabs plan={monthPlan} monthKey={key} />
      <ContentSchedule initialPosts={posts} view="list" />
    </div>
  );
}
