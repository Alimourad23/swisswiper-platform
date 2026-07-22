import { Suspense } from "react";
import InstagramDashboard from "@/components/marketing/InstagramDashboard";
import { getInstagramAnalytics } from "@/lib/marketing/instagram-data";
import { instagramObjectives } from "@/lib/marketing/channel-okr";
import { getPlannedFor } from "@/lib/marketing/schedule-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function InstagramSectionPage({ params }: { params: Promise<{ section: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[13px] bg-surface" />}>
        <Data params={params} />
      </Suspense>
    </div>
  );
}

async function Data({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const data = await getInstagramAnalytics();

  if (!data.connected) {
    return (
      <div className="sw-card flex max-w-xl flex-col items-start gap-3 p-6">
        <h3 className="text-base font-medium">Instagram isn&apos;t connected yet</h3>
        <p className="text-sm text-muted">{data.reason}</p>
        <a
          href="/api/instagram/connect"
          className="rounded-full bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793]"
        >
          Connect Instagram →
        </a>
      </div>
    );
  }

  const [objectives, planned] = await Promise.all([
    instagramObjectives(data.followers, data.reach28),
    getPlannedFor("instagram"),
  ]);
  return <InstagramDashboard data={data} section={section} objectives={objectives} planned={planned} />;
}
