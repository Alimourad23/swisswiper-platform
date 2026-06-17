import type { LinkedInMetrics, LinkedInPost } from "@/lib/linkedin/parse";

const DAY = 86400000;
const ms = (date: string) => Date.parse(date + "T00:00:00Z");

export type WindowAgg = {
  days: number;
  impressions: number;
  impressionsOrganic: number;
  impressionsSponsored: number;
  clicks: number;
  ctr: number;
  reactions: number;
  comments: number;
  reposts: number;
  engagements: number;
  engagementRate: number;
  newFollowers: number;
  pageViews: number;
  uniqueVisitors: number;
  growth: { label: string; value: number }[];
  prev: {
    impressions: number;
    clicks: number;
    ctr: number;
    engagementRate: number;
    newFollowers: number;
    pageViews: number;
  };
};

type ContentSum = {
  imp: number;
  impOrg: number;
  impSpon: number;
  clicks: number;
  reactions: number;
  comments: number;
  reposts: number;
};

function sumContent(m: LinkedInMetrics, a: number, b: number): ContentSum {
  const s: ContentSum = { imp: 0, impOrg: 0, impSpon: 0, clicks: 0, reactions: 0, comments: 0, reposts: 0 };
  for (const d of m.daily.content) {
    const t = ms(d.date);
    if (t < a || t > b) continue;
    s.impOrg += d.impOrg;
    s.impSpon += d.impSpon;
    s.imp += d.impOrg + d.impSpon;
    s.clicks += d.clkOrg + d.clkSpon;
    s.reactions += d.reacOrg + d.reacSpon;
    s.comments += d.comOrg + d.comSpon;
    s.reposts += d.repOrg + d.repSpon;
  }
  return s;
}

function sumFollowers(m: LinkedInMetrics, a: number, b: number): number {
  let n = 0;
  for (const d of m.daily.followers) {
    const t = ms(d.date);
    if (t >= a && t <= b) n += d.total;
  }
  return n;
}

function sumVisitors(m: LinkedInMetrics, a: number, b: number): { pageViews: number; unique: number } {
  let pageViews = 0;
  let unique = 0;
  for (const d of m.daily.visitors) {
    const t = ms(d.date);
    if (t >= a && t <= b) {
      pageViews += d.pageViews;
      unique += d.unique;
    }
  }
  return { pageViews, unique };
}

function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export function windowAgg(m: LinkedInMetrics, days: number): WindowAgg {
  const endMs = m.rangeEnd ? ms(m.rangeEnd) : Math.max(0, ...m.daily.content.map((d) => ms(d.date)));
  const startMs = endMs - (days - 1) * DAY;
  const prevEndMs = startMs - DAY;
  const prevStartMs = prevEndMs - (days - 1) * DAY;

  const c = sumContent(m, startMs, endMs);
  const p = sumContent(m, prevStartMs, prevEndMs);
  const v = sumVisitors(m, startMs, endMs);
  const engagements = c.clicks + c.reactions + c.comments + c.reposts;
  const pEng = p.clicks + p.reactions + p.comments + p.reposts;

  return {
    days,
    impressions: c.imp,
    impressionsOrganic: c.impOrg,
    impressionsSponsored: c.impSpon,
    clicks: c.clicks,
    ctr: rate(c.clicks, c.imp),
    reactions: c.reactions,
    comments: c.comments,
    reposts: c.reposts,
    engagements,
    engagementRate: rate(engagements, c.imp),
    newFollowers: sumFollowers(m, startMs, endMs),
    pageViews: v.pageViews,
    uniqueVisitors: v.unique,
    growth: growth(m, startMs, endMs, days),
    prev: {
      impressions: p.imp,
      clicks: p.clicks,
      ctr: rate(p.clicks, p.imp),
      engagementRate: rate(pEng, p.imp),
      newFollowers: sumFollowers(m, prevStartMs, prevEndMs),
      pageViews: sumVisitors(m, prevStartMs, prevEndMs).pageViews,
    },
  };
}

function growth(m: LinkedInMetrics, a: number, b: number, days: number) {
  const rows = m.daily.followers.filter((f) => ms(f.date) >= a && ms(f.date) <= b);
  if (days <= 7) {
    return rows.map((f) => ({ label: label(f.date, { weekday: "short" }), value: f.total }));
  }
  if (days <= 31) {
    const buckets: { label: string; value: number }[] = [];
    for (let i = 0; i < days; i += 7) {
      const s = a + i * DAY;
      const e = Math.min(b, s + 6 * DAY);
      const value = rows.filter((f) => ms(f.date) >= s && ms(f.date) <= e).reduce((n, f) => n + f.total, 0);
      buckets.push({ label: label(new Date(s).toISOString().slice(0, 10), { month: "short", day: "numeric" }), value });
    }
    return buckets;
  }
  const map = new Map<string, number>();
  for (const f of rows) {
    const key = f.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + f.total);
  }
  return Array.from(map.entries())
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([k, value]) => ({ label: label(k + "-01", { month: "short", year: "2-digit" }), value }));
}

function label(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function popPercent(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export type DMShare = { pct: number; dm: number; total: number };

const DM_RE = /\b(owner|director|vp|vice president|partner|cxo|chief|founder)\b/i;

export function decisionMakerShare(m: LinkedInMetrics): DMShare {
  let dm = 0;
  let total = 0;
  for (const s of m.demographics.seniority) {
    total += s.value;
    if (DM_RE.test(s.label)) dm += s.value;
  }
  return { pct: rate(dm, total), dm, total };
}

export type ContentTypeStat = {
  type: string;
  count: number;
  avgEngagement: number;
  avgCTR: number;
  impressions: number;
};

export function contentTypeBreakdown(posts: LinkedInPost[]): ContentTypeStat[] {
  const groups = new Map<string, LinkedInPost[]>();
  for (const p of posts) {
    const arr = groups.get(p.contentType) ?? [];
    arr.push(p);
    groups.set(p.contentType, arr);
  }
  return Array.from(groups.entries()).map(([type, list]) => ({
    type,
    count: list.length,
    avgEngagement: list.reduce((n, p) => n + p.engagementRate, 0) / list.length,
    avgCTR: list.reduce((n, p) => n + p.ctr, 0) / list.length,
    impressions: list.reduce((n, p) => n + p.impressions, 0),
  }));
}

export function bestByCTR(posts: LinkedInPost[], top = 3): LinkedInPost[] {
  return [...posts]
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, top);
}

export type FunnelStep = { label: string; value: number; ofPrevious: number | null; manual?: boolean };

export function funnel(agg: WindowAgg, inquiries: number): FunnelStep[] {
  const steps: FunnelStep[] = [
    { label: "Impressions", value: agg.impressions, ofPrevious: null },
    { label: "Post clicks", value: agg.clicks, ofPrevious: rate(agg.clicks, agg.impressions) },
    { label: "Page visits", value: agg.pageViews, ofPrevious: rate(agg.pageViews, agg.clicks) },
    { label: "Inquiries", value: inquiries, ofPrevious: rate(inquiries, agg.pageViews), manual: true },
  ];
  return steps;
}

export function alfredInsight(
  m: LinkedInMetrics,
  agg: WindowAgg,
  dm: DMShare,
  byType: ContentTypeStat[],
): string {
  const video = byType.find((t) => t.type === "Video");
  const text = byType.find((t) => t.type === "Text / Image");

  if (video && text && video.count >= 1 && video.avgEngagement > text.avgEngagement * 1.2) {
    return `Video posts average ${(video.avgEngagement * 100).toFixed(1)}% engagement vs ${(text.avgEngagement * 100).toFixed(1)}% for text/image — publish more video.`;
  }
  if (dm.pct >= 0.3) {
    return `${(dm.pct * 100).toFixed(0)}% of your followers are decision-makers (director-level or above) — your content is reaching buyers. Keep the executive tone.`;
  }

  const rangeDays =
    m.rangeStart && m.rangeEnd
      ? Math.max(1, Math.round((ms(m.rangeEnd) - ms(m.rangeStart)) / DAY))
      : 365;
  const perWeek = (m.posts.length / rangeDays) * 7;
  if (perWeek < 1) {
    return `You're posting ~${perWeek.toFixed(1)}×/week. Lifting to 2–3 posts/week is the fastest lever for reach.`;
  }
  return `Engagement is ${(agg.engagementRate * 100).toFixed(1)}% this period — strong. Double down on the posts driving clicks.`;
}
