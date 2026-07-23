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
import Objectives from "./Objectives";
import CreatePostButton from "./CreatePostButton";
import type { Objective } from "@/lib/marketing/okr";

/* The LinkedIn channel dashboard. Overview is a complete executive summary of
   the channel; each sub-section is the deep-dive. Header, time selector and
   Alfred's read are constant. Every number is from the weekly export. */

type Engager = { id: string; name: string; note: string | null };
export type PlannedPost = { title: string; scheduled_for: string | null; status: string; format: string };
type Props = {
  metrics: LinkedInMetrics; inquiries: number; source: string; capturedAt: string;
  engagers: Engager[]; section?: string; objectives?: Objective[]; planned?: PlannedPost[]; canEdit?: boolean;
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

function Head({ n, title, note, ctx }: { n: string; title: string; note?: string; ctx?: React.ReactNode }) {
  return (
    <div className="mc-zhead">
      <div className="mc-zt"><span className="mc-znum">{n}</span><h2>{title}</h2>{note ? <span className="mc-zd">— {note}</span> : null}</div>
      {ctx ? <span className="mc-zctx">{ctx}</span> : null}
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

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default function LinkedInDashboard({ metrics, inquiries, source, capturedAt, engagers, section = "overview", objectives, planned = [], canEdit = true }: Props) {
  const [days, setDays] = useState(365);
  const [cWin, setCWin] = useState(365); // Content timeline filter (days; 0 = all)
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

  // Content section: full post list filtered by its own timeline trigger + planned posts.
  const fmtDay = (s: string) => { try { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return s; } };
  const cCut = cWin > 0 ? Date.now() - cWin * 86_400_000 : 0;
  const allPosts = [...(metrics.posts ?? [])]
    .filter((p) => !cCut || (p.created && new Date(p.created).getTime() >= cCut))
    .sort((x, y) => (x.created < y.created ? 1 : -1));
  const upcoming = [...planned]
    .filter((p) => p.status !== "published")
    .sort((x, y) => (x.scheduled_for ?? "").localeCompare(y.scheduled_for ?? ""));

  const timeline = (
    <div className="mc-toggle">
      {[90, 365, 0].map((w) => (
        <button key={w} className={w === cWin ? "on" : ""} onClick={() => setCWin(w)}>{w === 0 ? "All" : w === 365 ? "12mo" : w + "d"}</button>
      ))}
    </div>
  );

  const kpiRow = (
    <div className="mc-kpis k5">
      <Kpi label="New followers" value={fmt(a.newFollowers)} d={dNF} />
      <Kpi label="Impressions" value={fmt(a.impressions)} d={dImp} />
      <Kpi label="Engagement" value={pct1(a.engagementRate)} d={dEng} />
      <Kpi label="Post clicks" value={fmt(a.clicks)} d={dClk} />
      <Kpi label="Page visits" value={fmt(a.pageViews)} d={dPv} />
    </div>
  );

  const funnelCard = (
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
  );

  const trendCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Impressions over time</h3><p className="mc-sub">Daily · recent window</p></div></div>
      <Spark data={series} color="var(--s-linkedin)" />
      <p className="mc-fnote">{fmt(a.impressions)} impressions · CTR {pct1(a.ctr)}</p>
    </div>
  );

  const formatCard = (
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
  );

  const topContentCard = (limit: number) => (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Top content</h3><p className="mc-sub">By click-through rate</p></div></div>
      <div style={{ marginTop: 3 }}>
        {top.length ? top.slice(0, limit).map((p, i) => (
          <div key={i} className="mc-content">
            <span className={"mc-thumb" + (i % 2 ? " alt" : "")}>{(p.contentType || "POST").slice(0, 10)}</span>
            <div className="mc-ct"><b>{p.title || "(untitled)"}</b><span>{fmt(p.impressions)} impressions · {fmt(p.likes)} reactions</span></div>
            <span className="mc-m">{pct1(p.ctr)} CTR</span>
          </div>
        )) : <p className="mc-soft" style={{ fontSize: 11 }}>Upload a LinkedIn export to see top posts.</p>}
      </div>
    </div>
  );

  const decisionCard = (
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
  );

  const demoGrid = (
    <div className="mc-g2">
      <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Seniority</h3><p className="mc-sub">Top levels</p></div></div><Bars items={(demo?.seniority ?? []).slice(0, 5)} /></div>
      <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Job function</h3><p className="mc-sub">Top functions</p></div></div><Bars items={(demo?.jobFunction ?? []).slice(0, 5)} /></div>
      <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Location</h3><p className="mc-sub">Top places</p></div></div><Bars items={(demo?.location ?? []).slice(0, 5)} /></div>
      <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Industry</h3><p className="mc-sub">Top industries</p></div></div><Bars items={(demo?.industry ?? []).slice(0, 5)} /></div>
    </div>
  );

  const engagersCard = (
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
  );

  const allPostsCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>All posts</h3><p className="mc-sub">{allPosts.length} in window · newest first</p></div></div>
      <div style={{ marginTop: 3, maxHeight: 360, overflowY: "auto" }}>
        {allPosts.length ? allPosts.map((p, i) => (
          <div key={i} className="mc-content">
            <span className={"mc-thumb" + (p.contentType === "Video" ? "" : " alt")}>{(p.contentType || "POST").slice(0, 10)}</span>
            <div className="mc-ct"><b>{p.title || "(untitled)"}</b><span>{p.created ? fmtDay(p.created) + " · " : ""}{fmt(p.impressions)} impressions · {fmt(p.likes)} reactions · {pct1(p.ctr)} CTR</span></div>
            {p.link ? <a className="mc-viewall" href={p.link} target="_blank" rel="noopener noreferrer">Open ↗</a> : null}
          </div>
        )) : <p className="mc-soft" style={{ fontSize: 11 }}>No posts in this window — widen the timeline, or upload a fresh export.</p>}
      </div>
    </div>
  );

  const plannedCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Planned &amp; upcoming</h3><p className="mc-sub">From your pipeline</p></div><a className="mc-viewall" href="/dashboard/marketing/pipeline">Pipeline →</a></div>
      <div style={{ marginTop: 3 }}>
        {upcoming.length ? upcoming.slice(0, 8).map((p, i) => (
          <div key={i} className="mc-content">
            <span className="mc-thumb alt">{(p.format || "PLAN").slice(0, 8).toUpperCase()}</span>
            <div className="mc-ct"><b>{p.title || "(untitled)"}</b><span>{p.scheduled_for ? fmtDay(p.scheduled_for) : "unscheduled"} · {p.status}</span></div>
          </div>
        )) : <p className="mc-soft" style={{ fontSize: 11 }}>Nothing planned yet — add posts in the pipeline and they’ll show here.</p>}
      </div>
    </div>
  );

  function report() {
    const rows = [
      ["New followers", fmt(a.newFollowers)], ["Impressions", fmt(a.impressions)],
      ["Engagement rate", pct1(a.engagementRate)], ["Post clicks", fmt(a.clicks)],
      ["Page visits", fmt(a.pageViews)], ["CTR", pct1(a.ctr)],
      ["Decision-makers", `${dm.dm} of ${dm.total} (${Math.round(dm.pct * 100)}%)`],
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>LinkedIn report — SwissWiper</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0b0f;max-width:720px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 2px}.sub{color:#6e6f78;font-size:13px;margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:9px 6px;border-bottom:1px solid #eee}td:last-child{text-align:right;font-weight:600}h2{font-size:14px;margin:22px 0 6px}li{font-size:13px;margin:3px 0}.hint{color:#9a9ba4;font-size:11px;margin-top:24px}@media print{body{margin:0}}</style></head>
<body><h1>LinkedIn — SwissWiper Page</h1><p class="sub">Report · last ${windowLabel} · generated ${new Date().toLocaleDateString("en-GB")}</p>
<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
<h2>Top content</h2><ol>${top.slice(0, 5).map((p) => `<li>${(p.title || "(untitled)").replace(/</g, "&lt;")} — ${pct1(p.ctr)} CTR, ${fmt(p.impressions)} impressions</li>`).join("")}</ol>
<h2>Audience — seniority</h2><ul>${(demo?.seniority ?? []).slice(0, 5).map((s) => `<li>${s.label}: ${fmt(s.value)}</li>`).join("")}</ul>
<p class="hint">SwissWiper · from the LinkedIn weekly export, captured ${capDate}. Open this file and print to PDF (Ctrl/Cmd+P → Save as PDF).</p>
</body></html>`;
    downloadHtml(`linkedin-report-${new Date().toISOString().slice(0, 10)}.html`, html);
  }

  const body = (() => {
    switch (section) {
      case "content":
        return (
          <section className="mc-zone">
            <Head n="02" title="Content" note="everything posted & planned" ctx={timeline} />
            {plannedCard}
            <div className="mc-split" style={{ marginTop: 11 }}>
              {allPostsCard}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>{topContentCard(5)}{formatCard}</div>
            </div>
          </section>
        );
      case "analytics":
        return (
          <section className="mc-zone">
            <Head n="02" title="Analytics" note="performance & audience" />
            {kpiRow}
            <div className="mc-g2" style={{ marginTop: 3 }}>{funnelCard}{trendCard}</div>
            <div className="mc-split" style={{ marginTop: 11 }}>
              {demoGrid}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>{decisionCard}{engagersCard}</div>
            </div>
          </section>
        );
      case "reports":
        return (
          <section className="mc-zone">
            <Head n="04" title="Reports" note={`snapshot · last ${windowLabel}`} />
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>LinkedIn report</h3><p className="mc-sub">Use the time selector above to set the window</p></div>
                <button className="mc-cta sm" onClick={report}>⤓&nbsp; Download</button></div>
              {kpiRow}
              <p className="mc-soft" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>Downloads a formatted report you can open and save as PDF (Ctrl/Cmd+P). Emailed and scheduled reports are next.</p>
            </div>
          </section>
        );
      case "engagement":
        return <section className="mc-zone"><Head n="" title="Engagement" /><SectionPlaceholder title="Engagement" reason="Comments and messages are handled in the Engagement inbox, where Alfred drafts replies in your founder voice and you approve every send." cta={<a className="mc-cta sm" href="/dashboard/marketing/engagement">Open Engagement inbox →</a>} /></section>;
      case "competitors":
        return <section className="mc-zone"><Head n="" title="Competitors" /><SectionPlaceholder title="Competitors" reason="Competitor benchmarking needs a source for the pages you want to track. Tell me which companies to watch and I'll wire it up." /></section>;
      case "campaigns":
        return <section className="mc-zone"><Head n="" title="Campaigns" /><SectionPlaceholder title="Campaigns" reason="Paid-campaign metrics appear here once you run LinkedIn ads and connect the ad account." /></section>;
      default:
        // OVERVIEW — a complete executive summary of the channel
        return (
          <section className="mc-zone">
            <Head n="01" title="Overview" note={`executive summary · last ${windowLabel}`} ctx={`${source === "seed" ? "Seed snapshot" : "Your export"} · ${capDate}`} />
            {kpiRow}
            <div className="mc-perfA">{funnelCard}{trendCard}{decisionCard}</div>
            <div className="mc-split">{topContentCard(3)}{formatCard}</div>
            {objectives?.length ? <Objectives title="Objectives · LinkedIn" items={objectives} editHref="/dashboard/marketing/plan" /> : null}
          </section>
        );
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
          {canEdit && <CreatePostButton channel="linkedin" />}
        </div>
      </div>

      <div className="mc-card mc-nextmove">
        <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>{insight}</p></div></div>
      </div>

      {body}

      <style>{COCKPIT_CSS}</style>
    </div>
  );
}
