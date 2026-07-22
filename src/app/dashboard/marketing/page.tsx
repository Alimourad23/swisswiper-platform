import { Suspense } from "react";
import MarketingCockpit from "@/components/marketing/MarketingCockpit";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getPlan } from "@/lib/marketing/plan-actions";
import { getInstagramLite } from "@/lib/marketing/instagram-data";
import { getOkrs } from "@/lib/marketing/okr-actions";
import { objectivesFrom } from "@/lib/marketing/okr";
import { createClient } from "@/lib/supabase/server";

async function getInquiries(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("marketing_inputs").select("inquiries").maybeSingle();
    return (data as { inquiries?: number } | null)?.inquiries ?? 0;
  } catch {
    return 0;
  }
}

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
  const [{ metrics }, posts, plan, ig, okrs, inquiries] = await Promise.all([
    getLinkedInMetrics(),
    getContentPosts(),
    getPlan(),
    getInstagramLite(),
    getOkrs(),
    getInquiries(),
  ]);

  const a30 = windowAgg(metrics, 30);
  const objectives = objectivesFrom(okrs.company, {
    followers: (metrics.followersAllTime ?? 0) + (ig?.followers ?? 0),
    reach: a30.impressions,
    inquiries,
  });

  return (
    <MarketingCockpit
      metrics={metrics}
      ig={ig}
      posts={posts}
      plan={plan}
      objectives={objectives}
      objective={okrs.objective}
    />
  );
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
