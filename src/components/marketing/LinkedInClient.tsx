"use client";

import { useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import TimeToggle from "@/components/marketing/TimeToggle";
import { AutoTag } from "@/components/Pill";
import {
  Kpi,
  SectionCard,
  BarChart,
  SplitBar,
  RankList,
  Funnel,
  DecisionMakerHero,
  ContentTypeBars,
  fmt,
} from "@/components/marketing/viz";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import {
  windowAgg,
  popPercent,
  decisionMakerShare,
  contentTypeBreakdown,
  bestByCTR,
  funnel as buildFunnel,
  alfredInsight,
} from "@/lib/linkedin/compute";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* Wraps a post row in a link to LinkedIn when a URL exists; plain row otherwise. */
function PostRow({ link, children }: { link: string; children: ReactNode }) {
  const base = "-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5";
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={`group ${base} transition-colors hover:bg-bg`}
      >
        {children}
      </a>
    );
  }
  return <div className={base}>{children}</div>;
}

export default function LinkedInClient({
  metrics,
  inquiries: initialInquiries,
  capturedAt,
  source,
}: {
  metrics: LinkedInMetrics;
  inquiries: number;
  capturedAt: string;
  source: "db" | "seed";
}) {
  const [days, setDays] = useState(365);
  const [inq, setInq] = useState(initialInquiries);
  const [savedNote, setSavedNote] = useState("");

  const a = windowAgg(metrics, days);
  const dm = decisionMakerShare(metrics);
  const byType = contentTypeBreakdown(metrics.posts);
  const best = bestByCTR(metrics.posts);
  const steps = buildFunnel(a, inq);
  const insight = alfredInsight(metrics, a, dm, byType);
  const topPosts = [...metrics.posts].sort((x, y) => y.impressions - x.impressions).slice(0, 5);

  async function saveInquiries() {
    const supabase = createClient();
    const { error } = await supabase
      .from("marketing_inputs")
      .upsert({ inquiries: inq }, { onConflict: "user_id" });
    setSavedNote(error ? "Couldn’t save (run the marketing_inputs SQL)." : "Saved.");
    setTimeout(() => setSavedNote(""), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-hint">
          {source === "seed" ? "Seed snapshot" : "Latest upload"} · captured {shortDate(capturedAt.slice(0, 10))} ·
          range {shortDate(metrics.rangeStart)} – {shortDate(metrics.rangeEnd)}
        </p>
        <TimeToggle value={days} onChange={setDays} />
      </div>

      {/* Alfred insight */}
      <div className="sw-card flex items-start gap-3 px-6 py-4">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-peri-soft text-[11px] font-medium text-peri-deep">
          A
        </span>
        <p className="text-sm text-ink">
          <span className="font-medium">Alfred:</span> {insight}
        </p>
      </div>

      <DecisionMakerHero share={dm} />

      {/* KPIs with period-over-period */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="New followers" value={fmt(a.newFollowers)} delta={popPercent(a.newFollowers, a.prev.newFollowers)} tag={<AutoTag label="Auto" />} />
        <Kpi label="Impressions" value={fmt(a.impressions)} delta={popPercent(a.impressions, a.prev.impressions)} sub={`org ${fmt(a.impressionsOrganic)}`} tag={<AutoTag label="Auto" />} />
        <Kpi label="Engagement" value={(a.engagementRate * 100).toFixed(1) + "%"} delta={popPercent(a.engagementRate, a.prev.engagementRate)} tag={<AutoTag label="Auto" />} />
        <Kpi label="Clicks" value={fmt(a.clicks)} delta={popPercent(a.clicks, a.prev.clicks)} sub={`CTR ${(a.ctr * 100).toFixed(2)}%`} tag={<AutoTag label="Auto" />} />
      </section>

      {/* Funnel */}
      <SectionCard
        title="Awareness → inquiry funnel"
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-hint">Inquiries</span>
            <input
              type="number"
              min={0}
              value={inq}
              onChange={(e) => setInq(Math.max(0, parseInt(e.target.value || "0", 10)))}
              className="h-8 w-20 rounded-[var(--radius-control)] border border-hairline bg-bg px-2 text-sm text-ink outline-none focus:border-peri-deep/40"
            />
            <button
              type="button"
              onClick={saveInquiries}
              className="h-8 rounded-[var(--radius-control)] bg-peri-deep px-3 text-xs font-medium text-white hover:bg-[#4d5793]"
            >
              Save
            </button>
            {savedNote && <span className="text-xs text-hint">{savedNote}</span>}
          </div>
        }
      >
        <Funnel steps={steps} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Follower growth" right={<AutoTag label="Auto" />}>
          <BarChart items={a.growth} />
          <p className="mt-3 text-sm text-muted">
            <strong className="font-medium text-ink">{fmt(metrics.followersAllTime)}</strong> total
            followers all-time
          </p>
        </SectionCard>

        <SectionCard title="Engagement split" right={<AutoTag label="Auto" />}>
          <SplitBar
            segments={[
              { label: "clicks", value: a.clicks },
              { label: "reactions", value: a.reactions },
              { label: "comments", value: a.comments },
              { label: "reposts", value: a.reposts },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Content type performance" right={<AutoTag label="Auto" />}>
          <ContentTypeBars stats={byType} />
        </SectionCard>

        <SectionCard title="Best posts by CTR" right={<AutoTag label="Auto" />}>
          {best.length > 0 ? (
            <ul className="flex flex-col">
              {best.map((p, i) => (
                <li key={i} className="border-t border-hairline first:border-t-0">
                  <PostRow link={p.link}>
                    <span className="min-w-0 truncate text-sm text-ink">{p.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-peri-deep">
                      {(p.ctr * 100).toFixed(1)}%
                      {p.link && (
                        <span aria-hidden className="text-hint transition-colors group-hover:text-peri-deep">
                          ↗
                        </span>
                      )}
                    </span>
                  </PostRow>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-hint">No posts yet.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Page visitors" right={<AutoTag label="Auto" />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-medium tracking-tight text-ink">{fmt(a.uniqueVisitors)}</p>
            <p className="mt-1 text-sm text-hint">unique visitors</p>
          </div>
          <div>
            <p className="text-3xl font-medium tracking-tight text-ink">{fmt(a.pageViews)}</p>
            <p className="mt-1 text-sm text-hint">page views</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Top posts" right={<AutoTag label="Auto" />}>
        {topPosts.length > 0 ? (
          <ul className="flex flex-col">
            {topPosts.map((p, i) => (
              <li key={i} className="border-t border-hairline first:border-t-0">
                <PostRow link={p.link}>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{p.title}</p>
                    <p className="mt-0.5 text-xs text-hint">
                      {fmt(p.impressions)} impressions · {(p.engagementRate * 100).toFixed(1)}% engagement · {p.contentType}
                    </p>
                  </div>
                  {p.link && (
                    <span aria-hidden className="shrink-0 self-center text-hint transition-colors group-hover:text-peri-deep">
                      ↗
                    </span>
                  )}
                </PostRow>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-hint">No posts in this export.</p>
        )}
      </SectionCard>

      <SectionCard title="Audience demographics" right={<AutoTag label="Auto" />}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <RankList title="Location" items={metrics.demographics.location} unit="followers" />
          <RankList title="Job function" items={metrics.demographics.jobFunction} unit="followers" />
          <RankList title="Seniority" items={metrics.demographics.seniority} unit="followers" />
          <RankList title="Industry" items={metrics.demographics.industry} unit="followers" />
          <RankList title="Company size" items={metrics.demographics.companySize} unit="followers" />
        </div>
      </SectionCard>
    </div>
  );
}
