"use client";

import { useState } from "react";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import type { ContentPost } from "@/lib/marketing/schedule";
import {
  windowAgg,
  popPercent,
  decisionMakerShare,
  contentTypeBreakdown,
  alfredInsight,
} from "@/lib/linkedin/compute";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function delta(cur: number, prev: number): string {
  const p = popPercent(cur, prev);
  if (p === null) return "";
  const s = p >= 0 ? "+" : "";
  return ` (${s}${p.toFixed(0)}% WoW)`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function WeeklyReport({
  metrics,
  posts,
  goal,
}: {
  metrics: LinkedInMetrics;
  posts: ContentPost[];
  goal: string;
}) {
  const [copied, setCopied] = useState(false);
  const a = windowAgg(metrics, 7);
  const dm = decisionMakerShare(metrics);
  const insight = alfredInsight(metrics, a, dm, contentTypeBreakdown(metrics.posts));

  // Posts published this week (Mon–Sun).
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const start = ymd(mon);
  const end = ymd(sun);
  const publishedThisWeek = posts.filter(
    (p) => p.status === "published" && p.scheduled_for && p.scheduled_for >= start && p.scheduled_for <= end,
  ).length;

  const rows = [
    { label: "New followers", value: fmt(a.newFollowers), d: delta(a.newFollowers, a.prev.newFollowers) },
    { label: "Impressions", value: fmt(a.impressions), d: delta(a.impressions, a.prev.impressions) },
    { label: "Engagement", value: `${(a.engagementRate * 100).toFixed(1)}%`, d: delta(a.engagementRate, a.prev.engagementRate) },
    { label: "Page visits", value: fmt(a.pageViews), d: delta(a.pageViews, a.prev.pageViews) },
  ];

  function copy() {
    const lines = [
      "SwissWiper — Marketing, last 7 days (LinkedIn)",
      ...rows.map((r) => `• ${r.label}: ${r.value}${r.d}`),
      `• Posts published this week: ${publishedThisWeek}`,
      "",
      `Read: ${insight}`,
      goal.trim() ? `Goal: ${goal.trim()}` : "",
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="sw-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <div>
          <h3 className="text-base font-medium">This week's report</h3>
          <p className="text-xs text-hint">LinkedIn · last 7 days vs the week before</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          {copied ? "Copied" : "Copy report"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-5 sm:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="rounded-[var(--radius-control)] bg-bg px-4 py-3">
            <p className="text-xs text-muted">{r.label}</p>
            <p className="mt-1 text-2xl font-medium tracking-tight text-ink">{r.value}</p>
            {r.d && <p className="text-[11px] text-hint">{r.d.replace(/[()]/g, "").trim()}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline px-6 py-4">
        <p className="text-sm text-ink">
          <span className="font-medium text-peri-deep">{publishedThisWeek}</span> post
          {publishedThisWeek === 1 ? "" : "s"} published this week.
        </p>
        <p className="text-sm text-muted">{insight}</p>
        {goal.trim() && <p className="text-xs text-hint">Goal: {goal.trim()}</p>}
      </div>
    </div>
  );
}
