import { Suspense } from "react";
import InstagramDashboard from "@/components/marketing/InstagramDashboard";
import { getInstagramAnalytics } from "@/lib/marketing/instagram-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Instagram channel dashboard — live from the Instagram API on every visit
   (no cron). Same compact cockpit language as the overview and LinkedIn. */

export default function InstagramPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <Suspense fallback={<Skeleton />}>
        <InstagramData />
      </Suspense>
    </div>
  );
}

async function InstagramData() {
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
        <p className="text-xs text-hint">
          Signs into @swisswiper and stores a self-refreshing connection — no more manual token renewals.
          (Requires the redirect link registered once in the Meta dashboard.)
        </p>
      </div>
    );
  }

  return <InstagramDashboard data={data} />;
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
    </div>
  );
}
