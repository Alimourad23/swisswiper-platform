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
import { COCKPIT_CSS, Spark, Ring, fmt, pct1 } from "./cockpit-ui";

/* The LinkedIn channel dashboard — same compact cockpit language as the
   overview, in sections the sidebar links to (#overview · #performance ·
   #audience). Every number is from your weekly export; nothing fabricated. */

type Engager = { id: string; name: string; note: string | null };
type Props = { metrics: LinkedInMetrics; inquiries: number; source: string; capturedAt: string; engagers: Engager[] };

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

export default function LinkedInDashboard({ metrics, inquiries, source, capturedAt, engagers }: Props) {
  const [days, setDays] = useState(365);
  const a = windowAgg(metrics, days);
  const dm = decisionMakerShare(metrics);
  const byType = contentTypeBreakdown(metrics.posts ?? []);
  const top = bestByCTR(metrics.posts ?? [], 4);
  const steps = funnel(a, inquiries);
  const insight = alfredInsight(metrics, a, dm, byType);

  const content = [...(metrics.daily?.content ?? [])].sort((x, y) => (x.date < y.date ? -1 : 1));
  const series = content.slice(-Math.min(days, 60)).map((d) => (d.impOrg ?? 0) + (d.impSpon ?? 0));

  const dNF = delta(a.newFollowers, a.prev.newFollowers);
  const dImp = delta(a.impressions, a.prev.impressions);
  const dEng = delta(a.engagementRate, a.prev.engagementRate);
  const dClk = delta(a.clicks, a.prev.clicks);
  const dPv = delta(a.pageViews, a.prev.pageViews);

  const demo = metrics.demographics;
  const capDate = (() => { try { return new Date(capturedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return capturedAt; } })();

  return (
    <div className="mc">
      <div className="mc-head">
        <h1 className="mc-h1"><span style={{ color: "var(--s-linkedin)", fontSize: 15 }}>●</span> LinkedIn <span>SwissWiper Page · from your weekly export</span></h1>
        <div className="mc-right">
          <span className="mc-badge blue">Auto · export</span>
          <div className="mc-toggle">
            {[7, 30, 365].map((d) => (
              <button key={d} className={d === days ? "on" : ""} onClick={() => setDays(d)}>{d === 365 ? "365d" : d + "d"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Alfred */}
      <div className="mc-card nextmove mc-nextmove">
        <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>{insight}</p></div></div>
      </div>

      {/* ══ OVERVIEW ══ */}
      <section className="mc-zone" id="overview">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">01</span><h2>Overview</h2><span className="mc-zd">— last {days === 365 ? "12 months" : days + " days"}</span></div>
          <span className="mc-zctx">{source === "seed" ? "Seed snapshot" : "Your export"} · {capDate}</span>
        </div>
        <div className="mc-kpis k5">
          <Kpi label={<>New followers</>} value={fmt(a.newFollowers)} d={dNF} />
          <Kpi label={<>Impressions</>} value={fmt(a.impressions)} d={dImp} />
          <Kpi label={<>Engagement</>} value={pct1(a.engagementRate)} d={dEng} />
          <Kpi label={<>Post clicks</>} value={fmt(a.clicks)} d={dClk} />
          <Kpi label={<>Page visits</>} value={fmt(a.pageViews)} d={dPv} />
        </div>
      </section>

      {/* ══ PERFORMANCE ══ */}
      <section className="mc-zone" id="performance">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">02</span><h2>Performance</h2><span className="mc-zd">— funnel, trend and format</span></div>
        </div>
        <div className="mc-g3">
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
      </section>

      {/* ══ AUDIENCE ══ */}
      <section className="mc-zone" id="audience">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">03</span><h2>Audience</h2><span className="mc-zd">— who is following</span></div>
        </div>
        <div className="mc-split">
          <div className="mc-g2">
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>Seniority</h3><p className="mc-sub">Top levels</p></div></div>
              <Bars items={(demo?.seniority ?? []).slice(0, 5)} />
            </div>
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>Job function</h3><p className="mc-sub">Top functions</p></div></div>
              <Bars items={(demo?.jobFunction ?? []).slice(0, 5)} />
            </div>
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>Location</h3><p className="mc-sub">Top places</p></div></div>
              <Bars items={(demo?.location ?? []).slice(0, 5)} />
            </div>
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>Industry</h3><p className="mc-sub">Top industries</p></div></div>
              <Bars items={(demo?.industry ?? []).slice(0, 5)} />
            </div>
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
                )) : <p className="mc-soft" style={{ fontSize: 11 }}>Add people worth knowing below.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

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
