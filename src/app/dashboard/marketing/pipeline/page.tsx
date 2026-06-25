import ModuleHeader from "@/components/ModuleHeader";
import ContentSchedule from "@/components/marketing/ContentSchedule";
import { getModule } from "@/lib/modules";
import { getContentPosts } from "@/lib/marketing/schedule-actions";

export const dynamic = "force-dynamic";

export default async function MarketingPipelinePage() {
  const m = getModule("marketing")!;
  const posts = await getContentPosts();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title="Pipeline"
        subtitle="Every post from idea to published — plan, queue and open the Studio to draft."
      />
      <ContentSchedule initialPosts={posts} view="list" />
    </div>
  );
}
