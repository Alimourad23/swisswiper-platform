"use client";

import { useState } from "react";
import Link from "next/link";
import TimeToggle from "@/components/marketing/TimeToggle";
import { LivePill, SoonPill, AutoTag } from "@/components/Pill";
import { Kpi, DecisionMakerHero, fmt } from "@/components/marketing/viz";
import { channels } from "@/lib/marketing/channels";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import { windowAgg, popPercent, decisionMakerShare } from "@/lib/linkedin/compute";

export type InstagramLiteCard = { username: string; followers: number; mediaCount: number } | null;

export default function MarketingOverviewClient({
  metrics,
  instagram = null,
}: {
  metrics: LinkedInMetrics;
  instagram?: InstagramLiteCard;
}) {
  const [days, setDays] = useState(365);
  const a = windowAgg(metrics, days);
  const dm = decisionMakerShare(metrics);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-hint">Summary · LinkedIn only</p>
        <TimeToggle value={days} onChange={setDays} />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="New followers" value={fmt(a.newFollowers)} delta={popPercent(a.newFollowers, a.prev.newFollowers)} tag={<AutoTag label="Auto" />} />
        <Kpi label="Impressions" value={fmt(a.impressions)} delta={popPercent(a.impressions, a.prev.impressions)} tag={<AutoTag label="Auto" />} />
        <Kpi label="Engagement" value={(a.engagementRate * 100).toFixed(1) + "%"} delta={popPercent(a.engagementRate, a.prev.engagementRate)} tag={<AutoTag label="Auto" />} />
        <Kpi label="Page visits" value={fmt(a.pageViews)} delta={popPercent(a.pageViews, a.prev.pageViews)} tag={<AutoTag label="Auto" />} />
      </section>
      <p className="-mt-2 text-xs text-hint">
        Other channels aren’t connected yet — they’re not counted here (not zero performance).
      </p>

      <DecisionMakerHero share={dm} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((c) =>
          c.key === "linkedin" ? (
            <div key={c.key} className="sw-card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-peri-soft text-peri-deep">
                  {c.icon}
                </span>
                <LivePill />
              </div>
              <h3 className="mt-4 text-base font-medium">LinkedIn</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="New foll." value={fmt(a.newFollowers)} />
                <Mini label="Impr." value={fmt(a.impressions)} />
                <Mini label="Engmt" value={(a.engagementRate * 100).toFixed(1) + "%"} />
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Link href="/dashboard/marketing/linkedin" className="text-sm font-medium text-peri-deep hover:underline">
                  View details →
                </Link>
                <Link href="/dashboard/marketing/linkedin#upload" className="text-xs font-medium text-muted hover:text-ink">
                  Update — upload export
                </Link>
              </div>
            </div>
          ) : c.key === "instagram" && instagram ? (
            <div key={c.key} className="sw-card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-peri-soft text-peri-deep">
                  {c.icon}
                </span>
                <LivePill />
              </div>
              <h3 className="mt-4 text-base font-medium">Instagram</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <Mini label="Followers" value={fmt(instagram.followers)} />
                <Mini label="Posts" value={fmt(instagram.mediaCount)} />
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Link href="/dashboard/marketing/instagram" className="text-sm font-medium text-peri-deep hover:underline">
                  View details →
                </Link>
                <span className="text-xs text-hint">@{instagram.username}</span>
              </div>
            </div>
          ) : (
            <div key={c.key} className="sw-soon flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-surface/70 text-peri-deep">
                  {c.icon}
                </span>
                <SoonPill />
              </div>
              <h3 className="mt-4 text-base font-medium text-ink">{c.name}</h3>
              <p className="mt-1 text-sm text-muted">Coming soon — connect for analytics.</p>
            </div>
          ),
        )}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-bg px-2 py-3">
      <p className="text-base font-medium tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-hint">{label}</p>
    </div>
  );
}
