import "server-only";
import { getRecentMedia, hasInstagramConnection } from "@/lib/instagram/client";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";

/* The analytics feedback loop: a compact, factual summary of what has ACTUALLY
   performed recently, injected into Alfred's monthly-plan prompt so his
   suggestions weight toward proven themes and formats. Pure read; every source
   is best-effort — a missing channel simply drops out of the brief. */

export async function getPerformanceBrief(): Promise<string> {
  const parts: string[] = [];

  // LinkedIn — last 30 days from the stored export data.
  try {
    const { metrics } = await getLinkedInMetrics();
    const a = windowAgg(metrics, 30);
    parts.push(
      `LinkedIn (last 30 days): ${a.impressions.toLocaleString()} impressions, ` +
        `${(a.engagementRate * 100).toFixed(1)}% engagement, ${a.newFollowers} new followers.`,
    );
  } catch {
    /* no LinkedIn data — skip */
  }

  // Instagram — live per-post engagement from the API.
  try {
    if (await hasInstagramConnection()) {
      const media = await getRecentMedia(18);
      if (media.length) {
        const score = (m: { likeCount: number; commentsCount: number }) => m.likeCount + m.commentsCount;
        const top = [...media].sort((x, y) => score(y) - score(x)).slice(0, 3);
        const byType = new Map<string, { n: number; total: number }>();
        for (const m of media) {
          const t = m.mediaType === "VIDEO" ? "Reel" : m.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Image post";
          const e = byType.get(t) ?? { n: 0, total: 0 };
          e.n++;
          e.total += score(m);
          byType.set(t, e);
        }
        const typeLine = [...byType.entries()]
          .map(([t, e]) => `${t} avg ${(e.total / e.n).toFixed(1)}`)
          .join(", ");
        const topLines = top
          .map((m) => `"${(m.caption || "").slice(0, 80).replace(/\s+/g, " ").trim() || "(no caption)"}" (${score(m)} engagements)`)
          .join("; ");
        parts.push(
          `Instagram (recent ${media.length} posts): engagement by format — ${typeLine}. ` +
            `Top performers: ${topLines}.`,
        );
      }
    }
  } catch {
    /* no Instagram data — skip */
  }

  return parts.join("\n");
}
