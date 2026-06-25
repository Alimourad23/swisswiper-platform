import ModuleHeader from "@/components/ModuleHeader";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import { getModule } from "@/lib/modules";
import { getContentPosts } from "@/lib/marketing/schedule-actions";

export const dynamic = "force-dynamic";

export default async function MarketingCalendarPage() {
  const m = getModule("marketing")!;
  const posts = await getContentPosts();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Content calendar"
        subtitle="Plan, draft and schedule your posts across channels."
      />
      <ContentSchedule initialPosts={posts} />
    </div>
  );
}
