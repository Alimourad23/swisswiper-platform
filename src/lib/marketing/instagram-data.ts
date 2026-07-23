import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  getInstagramAccountStats,
  getRecentMedia,
  hasInstagramConnection,
  tryAccountInsightTotals,
  tryAccountReach28,
  tryFollowerDemographics,
  tryMediaInsights,
  type IgDemographics,
  type IgMediaItem,
} from "@/lib/instagram/client";

/* Instagram analytics for the marketing module — LIVE from the Instagram API on
   every page view (no cron dependency). Each view also upserts today's snapshot
   row so a follower-growth history accumulates day by day.

   Single entry point per the module rule: the UI calls getInstagramAnalytics()
   and never touches the API client directly. */

export type IgSnapshot = { snap_date: string; followers: number };

export type IgMediaWithInsights = IgMediaItem & { reach: number | null; saved: number | null };

export type InstagramAnalytics =
  | { connected: false; reason: string }
  | {
      connected: true;
      username: string;
      followers: number;
      mediaCount: number;
      media: IgMediaWithInsights[];
      totalLikes: number;
      totalComments: number;
      /** (likes + comments) / posts, across the recent media window. */
      avgEngagementPerPost: number;
      /** 28-day account metrics — null when Instagram doesn't provide them. */
      reach28: number | null;
      views28: number | null;
      profileViews28: number | null;
      accountsEngaged28: number | null;
      /** Follower demographics by country — null until ~100 followers. */
      demographics: IgDemographics;
      /** Daily follower history (oldest → newest), built from page views. */
      snapshots: IgSnapshot[];
    };

/* Per-post insights are fetched for this many recent posts (1 API call each). */
const MEDIA_INSIGHTS_LIMIT = 12;

export async function getInstagramAnalytics(): Promise<InstagramAnalytics> {
  if (!(await hasInstagramConnection())) {
    return {
      connected: false,
      reason: "Instagram isn't connected yet — use Connect Instagram below, or set the access token.",
    };
  }
  try {
    const stats = await getInstagramAccountStats();
    const [mediaRaw, reach28, totals, demographics] = await Promise.all([
      getRecentMedia(24),
      tryAccountReach28(stats.userId),
      tryAccountInsightTotals(stats.userId),
      tryFollowerDemographics(stats.userId),
    ]);

    const media: IgMediaWithInsights[] = await Promise.all(
      mediaRaw.map(async (m, i) =>
        i < MEDIA_INSIGHTS_LIMIT ? { ...m, ...(await tryMediaInsights(m.id)) } : { ...m, reach: null, saved: null },
      ),
    );

    const totalLikes = media.reduce((n, m) => n + m.likeCount, 0);
    const totalComments = media.reduce((n, m) => n + m.commentsCount, 0);
    const avgEngagementPerPost = media.length
      ? Math.round(((totalLikes + totalComments) / media.length) * 10) / 10
      : 0;

    const snapshots = await recordAndReadSnapshots({
      followers: stats.followersCount,
      mediaCount: stats.mediaCount,
      totalLikes,
      totalComments,
    });

    return {
      connected: true,
      username: stats.username,
      followers: stats.followersCount,
      mediaCount: stats.mediaCount,
      media,
      totalLikes,
      totalComments,
      avgEngagementPerPost,
      reach28,
      views28: totals.views,
      profileViews28: totals.profileViews,
      accountsEngaged28: totals.accountsEngaged,
      demographics,
      snapshots,
    };
  } catch (e) {
    return {
      connected: false,
      reason: e instanceof Error ? e.message : "Instagram is unreachable at the moment.",
    };
  }
}

/* Upsert today's snapshot + return the history. Best-effort: if the table
   isn't created yet, analytics still render (just without growth). */
async function recordAndReadSnapshots(row: {
  followers: number;
  mediaCount: number;
  totalLikes: number;
  totalComments: number;
}): Promise<IgSnapshot[]> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("ig_daily_snapshots").upsert(
      {
        snap_date: today,
        followers: row.followers,
        media_count: row.mediaCount,
        total_likes: row.totalLikes,
        total_comments: row.totalComments,
      },
      { onConflict: "snap_date" },
    );
    const { data } = await supabase
      .from("ig_daily_snapshots")
      .select("snap_date, followers")
      .order("snap_date", { ascending: true })
      .limit(365);
    return (data ?? []) as IgSnapshot[];
  } catch {
    return [];
  }
}

/* Lite version for the Marketing overview card — one API call, null when not
   connected or unreachable (the card falls back to "Soon"). */
export type IgLite = { username: string; followers: number; mediaCount: number } | null;

export async function getInstagramLite(): Promise<IgLite> {
  if (!(await hasInstagramConnection())) return null;
  try {
    const s = await getInstagramAccountStats();
    return { username: s.username, followers: s.followersCount, mediaCount: s.mediaCount };
  } catch {
    return null;
  }
}

/* Mid-weight pulse for the Marketing cockpit — followers + 28-day reach + average
   engagement per post, in ~3 API calls (no per-post insights). Enough to show a
   real Instagram row in the executive summary without the full analytics cost. */
export type IgPulse =
  | { username: string; followers: number; mediaCount: number; reach28: number | null; avgEngagementPerPost: number }
  | null;

export async function getInstagramPulse(): Promise<IgPulse> {
  if (!(await hasInstagramConnection())) return null;
  try {
    const s = await getInstagramAccountStats();
    const [media, reach28] = await Promise.all([getRecentMedia(24), tryAccountReach28(s.userId)]);
    const totalLikes = media.reduce((n, m) => n + m.likeCount, 0);
    const totalComments = media.reduce((n, m) => n + m.commentsCount, 0);
    const avgEngagementPerPost = media.length ? Math.round(((totalLikes + totalComments) / media.length) * 10) / 10 : 0;
    return { username: s.username, followers: s.followersCount, mediaCount: s.mediaCount, reach28, avgEngagementPerPost };
  } catch {
    return null;
  }
}
