import ModuleHeader from "@/components/ModuleHeader";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import { getModule } from "@/lib/modules";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getIsFounder } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // "Publish now" waits for Instagram to process media

export default async function MarketingCalendarPage() {
  const m = getModule("marketing")!;
  const [posts, isFounder] = await Promise.all([getContentPosts(), getIsFounder()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Content calendar"
        subtitle="Your month at a glance — drag posts to reschedule, click to open the Studio."
      />
      <ContentSchedule initialPosts={posts} view="calendar" isFounder={isFounder} />
    </div>
  );
}
