import ModuleHeader from "@/components/ModuleHeader";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import PlannerTabs from "@/components/marketing/PlannerTabs";
import { getModule } from "@/lib/modules";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getMonthPlan } from "@/lib/marketing/monthly-actions";
import { horizonMonths } from "@/lib/marketing/monthly";
import { getIsFounder } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // "Publish now" waits for Instagram to process media

export default async function MarketingPipelinePage() {
  const m = getModule("marketing")!;
  const months = horizonMonths(6); // current + next 5
  const key = months[0]; // default: the current month (plan the rest of it)
  const [posts, monthPlan, isFounder] = await Promise.all([getContentPosts(), getMonthPlan(key), getIsFounder()]);

  // Planned posts per channel, per month (for the gap counter across the horizon).
  const countsByMonth: Record<string, Record<string, number>> = {};
  for (const k of months) countsByMonth[k] = {};
  for (const p of posts) {
    const mk = p.scheduled_for?.slice(0, 7);
    if (mk && countsByMonth[mk]) {
      countsByMonth[mk][p.channel] = (countsByMonth[mk][p.channel] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Pipeline"
        subtitle="Every post from idea to published — plan, queue and open the Studio to draft."
      />
      <PlannerTabs plan={monthPlan} monthKey={key} months={months} countsByMonth={countsByMonth} />
      <ContentSchedule initialPosts={posts} view="list" isFounder={isFounder} />
    </div>
  );
}
