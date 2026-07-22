import "server-only";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import { windowAgg } from "@/lib/linkedin/compute";
import { getContentPosts } from "@/lib/marketing/schedule-actions";
import { getOkrs } from "@/lib/marketing/okr-actions";
import { objectivesFrom, type Objective } from "@/lib/marketing/okr";

/* Per-channel objectives: the channel's KRs measured against its live numbers.
   Used by the channel pages to pass ready-made progress into the dashboards. */

function postsThisMonth(posts: { channel: string; scheduled_for: string | null; status: string }[], channel: string): number {
  const month = new Date().toISOString().slice(0, 7);
  return posts.filter((p) => p.channel === channel && p.scheduled_for?.slice(0, 7) === month && p.status !== "idea").length;
}

export async function linkedinObjectives(metrics: LinkedInMetrics): Promise<Objective[]> {
  const [okrs, posts] = await Promise.all([getOkrs(), getContentPosts()]);
  const a = windowAgg(metrics, 30);
  return objectivesFrom(okrs.linkedin, {
    followers: metrics.followersAllTime ?? 0,
    engagement: a.engagementRate * 100,
    posts: postsThisMonth(posts, "linkedin"),
  });
}

export async function instagramObjectives(followers: number, reach28: number | null): Promise<Objective[]> {
  const [okrs, posts] = await Promise.all([getOkrs(), getContentPosts()]);
  return objectivesFrom(okrs.instagram, {
    followers,
    reach: reach28 ?? 0,
    posts: postsThisMonth(posts, "instagram"),
  });
}
