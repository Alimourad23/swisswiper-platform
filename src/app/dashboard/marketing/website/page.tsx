"use client";

import { COCKPIT_CSS } from "@/components/marketing/cockpit-ui";

/* The Website channel dashboard — same compact cockpit language as the other
   channels. Until GA4 is connected it shows honest placeholders (never
   fabricated numbers); the panels fill in automatically once the tag reports. */

export default function WebsitePage() {
  const placeholders = [
    { label: "Visitors" },
    { label: "Page views" },
    { label: "Avg. time on page" },
    { label: "Traffic sources" },
    { label: "Top pages" },
    { label: "Inquiries" },
  ];
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mc">
        <div className="mc-head">
          <h1 className="mc-h1"><span style={{ color: "var(--peri-deep)", fontSize: 15 }}>◍</span> Website <span>swisswiper.com · analytics</span></h1>
          <div className="mc-right">
            <span className="mc-badge">Awaiting GA4</span>
            <a className="mc-cta" href="https://swisswiper.com/" target="_blank" rel="noopener">Visit site ↗</a>
          </div>
        </div>

        <div className="mc-card mc-nextmove">
          <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>Once GA4 is live I’ll watch which channels actually drive site visits, which pages hold attention, and where visits turn into inquiries — and flag what to double down on. Nothing to read yet; the tag needs to start reporting.</p></div></div>
        </div>

        <section className="mc-zone" id="overview">
          <div className="mc-zhead">
            <div className="mc-zt"><span className="mc-znum">01</span><h2>Overview</h2><span className="mc-zd">— fills in once GA4 is live</span></div>
          </div>
          <div className="mc-kpis">
            {placeholders.map((p) => (
              <div key={p.label} className="mc-card mc-kpi">
                <div className="mc-ktop"><span className="mc-klbl">{p.label}</span></div>
                <span className="mc-kval" style={{ color: "var(--mc-hint)" }}>—</span>
                <span className="mc-kdelta muted">connect GA4</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mc-zone">
          <div className="mc-zhead">
            <div className="mc-zt"><span className="mc-znum">02</span><h2>Connect analytics</h2><span className="mc-zd">— one-time setup</span></div>
          </div>
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Website analytics arrive with GA4</h3><p className="mc-sub">Traffic, sources and the top of your marketing funnel</p></div></div>
            <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--mc-muted)", lineHeight: 1.55, maxWidth: 620 }}>
              Add the Google Analytics 4 tag to swisswiper.com and this page comes alive: daily visitors and page views,
              where traffic comes from (search, social, direct, referral), your top pages, and how site visits feed into
              inquiries. Nothing here is estimated — the panels stay empty until real data reports.
            </p>
            <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
              <a className="mc-cta" href="https://analytics.google.com/" target="_blank" rel="noopener">Open Google Analytics ↗</a>
              <a className="mc-cta sm" style={{ background: "var(--peri-soft)", color: "var(--peri-deep)" }} href="https://swisswiper.com/" target="_blank" rel="noopener">Visit swisswiper.com ↗</a>
            </div>
          </div>
        </section>

        <style>{COCKPIT_CSS}</style>
      </div>
    </div>
  );
}
