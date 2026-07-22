import { Suspense } from "react";
import MarketingCockpit from "@/components/marketing/MarketingCockpit";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getPlan } from "@/lib/marketing/plan-actions";
import { getInstagramLite } from "@/lib/marketing/instagram-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* The marketing overview — a four-zone executive cockpit:
   01 Executive summary · 02 Performance · 03 Alfred's insight · 04 Planning.
   Wired to real LinkedIn, Instagram, posts and plan data with honest empty
   states. Plan, Pipeline, Calendar and the channel pages live in the sidebar. */

export default function MarketingPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <Suspense fallback={<Skeleton />}>
        <MarketingData />
      </Suspense>
    </div>
  );
}

async function MarketingData() {
  const [{ metrics }, posts, plan, ig] = await Promise.all([
    getLinkedInMetrics(),
    getContentPosts(),
    getPlan(),
    getInstagramLite(),
  ]);
  return <MarketingCockpit metrics={metrics} ig={ig} posts={posts} plan={plan} />;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-[13px] bg-surface" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-[13px] bg-surface" />
      <div className="h-40 animate-pulse rounded-[13px] bg-surface" />
    </div>
  );
}
