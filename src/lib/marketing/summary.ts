import "server-only";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg, decisionMakerShare } from "@/lib/linkedin/compute";
import { getInstagramLite } from "@/lib/marketing/instagram-data";

/* ONE marketing summary, read by every screen that shows a marketing pulse —
   the Overview, Alfred's morning brief, and Alfred's chat brain. Keeping this the
   single source of truth means those three can never drift apart again (which is
   how the Overview and Alfred ended up LinkedIn-only while Instagram was live).

   Uses the LITE Instagram call (one request → followers) so it stays fast on the
   home screen; the full Instagram analytics live on the Instagram channel page. */

export type MarketingSummary = {
  linkedin: {
    followers: number;
    impressions: number; // last 365 days
    engagementRatePct: number;
    decisionMakerPct: number;
  };
  instagram: { username: string; followers: number } | null;
  /** LinkedIn + Instagram followers combined. */
  totalAudience: number;
};

export async function getMarketingSummary(): Promise<MarketingSummary> {
  const [liRes, ig] = await Promise.all([
    getLinkedInMetrics(),
    getInstagramLite().catch(() => null),
  ]);

  const li = liRes.metrics;
  const agg = windowAgg(li, 365);
  const dm = decisionMakerShare(li);
  const linkedin = {
    followers: li.followersAllTime,
    impressions: agg.impressions,
    engagementRatePct: agg.engagementRate * 100,
    decisionMakerPct: dm.pct * 100,
  };

  const instagram = ig ? { username: ig.username, followers: ig.followers } : null;

  return {
    linkedin,
    instagram,
    totalAudience: linkedin.followers + (instagram?.followers ?? 0),
  };
}
