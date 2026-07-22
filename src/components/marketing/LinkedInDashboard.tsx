"use client";

import { useState } from "react";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import {
  windowAgg,
  popPercent,
  decisionMakerShare,
  contentTypeBreakdown,
  bestByCTR,
  funnel,
  alfredInsight,
} from "@/lib/linkedin/compute";
import { COCKPIT_CSS, Spark, Ring, SectionPlaceholder, fmt, pct1 } from "./cockpit-ui";
import { LinkedInLogo } from "./logos";

/* The LinkedIn channel dashboard — one page per sidebar section. The header,
   time selector and Alfred's read are constant; the body swaps by section.
   Every number is from your weekly export; empty sections say so honestly. */

type Engager = { id: string; name: string; note: string | null };
type Props = {
  metrics: LinkedInMetrics; inquiries: number; source: string; capturedAt: string;
  engagers: Engager[]; section?: string;
};

function delta(cur: number, prev: number): { text: string; good: boolean } | null {
  if (prev <= 0) return cur > 0 ? { text: "new", good: true } : null;
  const p = popPercent(cur, prev);
  if (p === null) return null;
  const r = Math.round(p);
  if (Math.abs(r) > 300) { const d = cur - prev; return { text: (d >= 0 ? "+" : "") + fmt(d), good: d >= 0 }; }
  return { text: (r >= 0 ? "+" : "") + r + "%", good: r >= 0 };
}

function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <>
      {items.map((it) => (
        <div key={it.label} className="mc-hbar wide">
          <span className="mc-n" title={it.label}>{it.label}</span>
          <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.round((it.value / max) * 100)}%` }} /></div>
          <span className="mc-v">{fmt(it.value)}</span>
        </div>
      ))}
    </>
  );
}

function SectionHead({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="mc-zhead">
      <div className="mc-zt"><span className="mc-znum">{n}</span><h2>{title}</h2>{note ? <span className="mc-zd">— {note}</span> : null}</div>
    </div>
  );
}

export default function LinkedInDashboard({ metrics, inquiries, source, capturedAt, engagers, section = "overview" }: Props) {
  const [days, setDays] = useState(365);
  const a = windowAgg(metrics, days);
  const dm = decisionMakerShare(metrics);
  const byType = contentTypeBreakdown(metrics.posts ?? []);
  const top = bestByCTR(metrics.posts ?? [], 6);
  const steps = funnel(a, inquiries);
  const insight = alfredInsight(metrics, a, dm, byType);

  const daily = [...(metrics.daily?.content ?? [])].sort((x, y) => (x.date < y.date ? -1 : 1));
  const series = daily.slice(-Math.min(days, 60)).map((d) => (d.impOrg ?? 0) + (d.impSpon ?? 0));

  const dNF = delta(a.newFollowers, a.prev.newFollowers);
  const dImp = delta(a.impressions, a.prev.impressions);
  const dEng = delta(a.engagementRate, a.prev.engagementRate);
  const dClk = delta(a.clicks, a.prev.clicks);
  const dPv = delta(a.pageViews, a.prev.pageViews);

  const demo = metrics.demographics;
  const capDate = (() => { try { return new Date(capturedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return capturedAt; } })();
  const windowLabel = days === 365 ? "12 months" : `${days} days`;

  const Overview = (
    <section className="mc-zone">
      <SectionHead n="01" title="Overview" note={`last ${windowLabel}`} />
      <div className="mc-kpis k5">
        <Kpi label="New followers" value={fmt(a.newFollowers)} d={dNF} />
        <Kpi label="Impressions" value={fmt(a.impressions)} d={dImp} />
        <Kpi label="Engagement" value={pct1(a.engagementRate)} d={dEng} />
        <Kpi label="Post clicks" value={fmt(a.clicks)} d={dClk} />
        <Kpi label="Page visits" value={fmt(a.pageViews)} d={dPv} />
      </div>
    </section>
  );

  const Analytics = (
    <section className="mc-zone">
      <SectionHead n="02" title="Analytics" note="funnel and trend" />
      <div className="mc-g2">
        <div className="mc-card mc-panel">
          <div className="mc-ph"><div><h3>Funnel</h3><p className="mc-sub">Impressions → inquiry</p></div></div>
          <div className="mc-funnel">
            {steps.map((s, i) => {
              const w = Math.max(18, Math.round((s.value / (steps[0].value || 1)) * 72));
              const showPct = s.ofPrevious != null && s.ofPrevious > 0 && s.ofPrevious <= 1;
              return (
                <div key={s.label} className="mc-frow">
                  <div className="mc-fstage" style={{ width: `${w}%`, background: `var(--o${i + 1})` }}>{s.label}</div>
                  <span className="mc-fval">{fmt(s.value)}{showPct ? ` · ${(s.ofPrevious! * 100).toFixed(1)}%` : ""}{s.manual ? " · manual" : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mc-card mc-panel">
          <div className="mc-ph"><div><h3>Impressions over time</h3><p className="mc-sub">Daily · recent window</p></div></div>
          <Spark data={series} color="var(--s-linkedin)" />
          <p className="mc-fnote">{fmt(a.impressions)} impressions · CTR {pct1(a.ctr)}</p>
        </div>
      </div>
    </section>
  );

  const Content = (
    <section className="mc-zone">
      <SectionHead n="02" title="Content" note="posts and formats" />
      <div className="mc-split">
        <div className="mc-card mc-panel">
          <div className="mc-ph"><div><h3>Top content</h3><p className="mc-sub">By click-through rate</p></div></div>
          <div style={{ marginTop: 3 }}>
            {top.length ? top.map((p, i) => (
              <div key={i} className="mc-content">
                <span className={"mc-thumb" + (i % 2 ? " alt" : "")}>{(p.contentType || "POST").slice(0, 10)}</span>
                <div className="mc-ct"><b>{p.title || "(untitled)"}</b><span>{fmt(p.impressions)} impressions · {fmt(p.likes)} reactions</span></div>
                <span className="mc-m">{pct1(p.ctr)} CTR</span>
              </div>
            )) : <p className="mc-soft" style={{ fontSize: 11 }}>Upload a LinkedIn export to see top posts.</p>}
          </div>
        </div>
        <div className="mc-card mc-panel">
          <div className="mc-ph"><div><h3>Format performance</h3><p className="mc-sub">Avg engagement by type</p></div></div>
          {byType.length ? byType.map((t) => {
            const max = Math.max(...byType.map((x) => x.avgEngagement), 0.0001);
            return (
              <div key={t.type} className="mc-hbar">
                <span className="mc-n">{t.type === "Text / Image" ? "Text/Img" : t.type}</span>
                <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.round((t.avgEngagement / max) * 100)}%` }} /></div>
                <span className="mc-v">{pct1(t.avgEngagement)}</span>
              </div>
            );
          }) : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>No post data yet.</p>}
        </div>
      </div>
    </section>
  );

  const Audience = (
    <section className="mc-zone">
      <SectionHead n="03" title="Audience" note="who is following" />
      <div className="mc-split">
        <div className="mc-g2">
          <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Seniority</h3><p className="mc-sub">Top levels</p></div></div><Bars items={(demo?.seniority ?? []).slice(0, 5)} /></div>
          <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Job function</h3><p className="mc-sub">Top functions</p></div></div><Bars items={(demo?.jobFunction ?? []).slice(0, 5)} /></div>
          <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Location</h3><p className="mc-sub">Top places</p></div></div><Bars items={(demo?.location ?? []).slice(0, 5)} /></div>
          <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Industry</h3><p className="mc-sub">Top industries</p></div></div><Bars items={(demo?.industry ?? []).slice(0, 5)} /></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Decision-makers</h3><p className="mc-sub">Director-level or above</p></div></div>
            <div className="mc-ringrow" style={{ marginTop: 8 }}>
              <Ring pct={dm.pct} label={`${Math.round(dm.pct * 100)}%`} size={96} />
              <div className="mc-obj">
                <div className="mc-o"><span>Decision-makers</span><b>{dm.dm} of {dm.total}</b></div>
                <p className="mc-sub" style={{ marginTop: 2 }}>Owner, Director, VP, Partner, CXO.</p>
              </div>
            </div>
          </div>
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Notable engagers</h3><p className="mc-sub">People worth knowing</p></div></div>
            <div style={{ marginTop: 4 }}>
              {engagers.length ? engagers.slice(0, 6).map((e) => (
                <div key={e.id} className="mc-content">
                  <span className="mc-thumb alt">{e.name.slice(0, 2).toUpperCase()}</span>
                  <div className="mc-ct"><b>{e.name}</b>{e.note ? <span>{e.note}</span> : null}</div>
                </div>
              )) : <p className="mc-soft" style={{ fontSize: 11 }}>Add people worth knowing on the Overview page.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const Reports = (
    <section className="mc-zone">
      <SectionHead n="04" title="Reports" note={`snapshot · last ${windowLabel}`} />
      <div className="mc-card mc-panel">
        <div className="mc-ph"><div><h3>LinkedIn report</h3><p className="mc-sub">Use the time selector above to set the window</p></div><span className="mc-badge blue">{days === 365 ? "365d" : days + "d"}</span></div>
        <div className="mc-kpis k5" style={{ marginTop: 10 }}>
          <Kpi label="New followers" value={fmt(a.newFollowers)} d={dNF} />
          <Kpi label="Impressions" value={fmt(a.impressions)} d={dImp} />
          <Kpi label="Engagement" value={pct1(a.engagementRate)} d={dEng} />
          <Kpi label="Post clicks" value={fmt(a.clicks)} d={dClk} />
          <Kpi label="Page visits" value={fmt(a.pageViews)} d={dPv} />
        </div>
        <p className="mc-soft" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          One-click PDF and emailed reports are coming next — for now this is your live snapshot for the selected window.
        </p>
      </div>
    </section>
  );

  const body = (() => {
    switch (section) {
      case "content": return Content;
      case "analytics": return Analytics;
      case "audience": return Audience;
      case "reports": return Reports;
      case "engagement":
        return (
          <section className="mc-zone">
            <SectionHead n="" title="Engagement" />
            <SectionPlaceholder
              title="Engagement"
              reason="Comments and messages are handled in the Engagement inbox, where Alfred drafts replies in your founder voice and you approve every send."
              cta={<a className="mc-cta sm" href="/dashboard/marketing/engagement">Open Engagement inbox →</a>}
            />
          </section>
        );
      case "stories":
      case "reels":
        return (
          <section className="mc-zone">
            <SectionHead n="" title={section === "stories" ? "Stories" : "Reels"} />
            <SectionPlaceholder title={section === "stories" ? "Stories" : "Reels"} reason="LinkedIn doesn't publish Stories or Reels — this section stays here so every channel reads the same way, and simply won't carry data for LinkedIn." />
          </section>
        );
      case "hashtags":
        return <section className="mc-zone"><SectionHead n="" title="Hashtags" /><SectionPlaceholder title="Hashtags" reason="Hashtag performance needs post-level tag data, which the weekly LinkedIn export doesn't include. It appears here once we capture tags per post." /></section>;
      case "competitors":
        return <section className="mc-zone"><SectionHead n="" title="Competitors" /><SectionPlaceholder title="Competitors" reason="Competitor benchmarking needs a data source for the pages you want to track. Tell me which companies to watch and I'll wire it up." /></section>;
      case "campaigns":
        return <section className="mc-zone"><SectionHead n="" title="Campaigns" /><SectionPlaceholder title="Campaigns" reason="Paid-campaign metrics appear here once you run LinkedIn ads and connect the ad account." /></section>;
      default: return Overview;
    }
  })();

  return (
    <div className="mc">
      <div className="mc-head">
        <h1 className="mc-h1"><LinkedInLogo size={18} /> LinkedIn <span>SwissWiper Page · from your weekly export</span></h1>
        <div className="mc-right">
          <span className="mc-badge blue">Auto · export</span>
          <div className="mc-toggle">
            {[7, 30, 365].map((d) => (
              <button key={d} className={d === days ? "on" : ""} onClick={() => setDays(d)}>{d === 365 ? "365d" : d + "d"}</button>
            ))}
          </div>
          <a className="mc-cta" href="/dashboard/marketing/pipeline?channel=linkedin">✦&nbsp; Create post</a>
        </div>
      </div>

      <div className="mc-card mc-nextmove">
        <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>{insight}</p></div></div>
      </div>

      {body}

      <p className="mc-foot">{source === "seed" ? "Seed snapshot" : "Your export"} · captured {capDate}</p>
      <style>{COCKPIT_CSS}</style>
    </div>
  );
}

function Kpi({ label, value, d }: { label: React.ReactNode; value: string; d: { text: string; good: boolean } | null }) {
  return (
    <div className="mc-card mc-kpi">
      <div className="mc-ktop"><span className="mc-klbl">{label}</span></div>
      <span className="mc-kval">{value}</span>
      {d ? <span className="mc-kdelta" style={d.good ? undefined : { color: "var(--mc-hint)" }}>{d.text}<span className="mc-soft"> vs prior</span></span> : <span className="mc-kdelta muted">— vs prior</span>}
    </div>
  );
}
