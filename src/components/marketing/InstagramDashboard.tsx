"use client";

import { COCKPIT_CSS, Spark, SectionPlaceholder, fmt } from "./cockpit-ui";
import { InstagramLogo } from "./logos";
import Objectives from "./Objectives";
import type { Objective } from "@/lib/marketing/okr";

/* The Instagram channel dashboard. Overview is a complete executive summary of
   the account; each sub-section is the deep-dive. Live from the Instagram API;
   honest empties where a metric isn't provided yet. */

type IgMedia = {
  id: string; caption: string | null; mediaType: string;
  mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null;
  timestamp: string; likeCount: number; commentsCount: number; reach: number | null; saved: number | null;
};
export type IgData = {
  username: string; followers: number; mediaCount: number; media: IgMedia[];
  totalLikes: number; totalComments: number; avgEngagementPerPost: number;
  reach28: number | null; views28: number | null; profileViews28: number | null; accountsEngaged28: number | null;
  demographics: { entries: { name: string; value: number }[] } | null;
  snapshots: { snap_date: string; followers: number }[];
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const typeName = (t: string) => (t === "VIDEO" ? "Reel" : t === "CAROUSEL_ALBUM" ? "Carousel" : "Image");

function Head({ n, title, note, ctx }: { n: string; title: string; note?: string; ctx?: string }) {
  return (
    <div className="mc-zhead">
      <div className="mc-zt"><span className="mc-znum">{n}</span><h2>{title}</h2>{note ? <span className="mc-zd">— {note}</span> : null}</div>
      {ctx ? <span className="mc-zctx">{ctx}</span> : null}
    </div>
  );
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="mc-card mc-kpi">
      <div className="mc-ktop"><span className="mc-klbl">{label}</span></div>
      <span className="mc-kval">{value}</span>
      <span className="mc-kdelta muted">{note ?? " "}</span>
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

export default function InstagramDashboard({ data, section = "overview", objectives }: { data: IgData; section?: string; objectives?: Objective[] }) {
  const kpis: { label: string; value: string; note?: string }[] = [
    { label: "Followers", value: fmt(data.followers), note: growthNote(data) },
    { label: "Posts", value: fmt(data.mediaCount) },
    { label: "Avg eng./post", value: fmt(data.avgEngagementPerPost), note: `last ${data.media.length}` },
  ];
  if (data.reach28 !== null) kpis.push({ label: "Reach · 28d", value: fmt(data.reach28) });
  else kpis.push({ label: "Total likes", value: fmt(data.totalLikes) });
  if (data.profileViews28 !== null) kpis.push({ label: "Profile visits · 28d", value: fmt(data.profileViews28) });
  if (data.views28 !== null) kpis.push({ label: "Views · 28d", value: fmt(data.views28) });
  const kClass = kpis.length >= 6 ? "" : kpis.length === 5 ? "k5" : "k4";
  const kpiRow = <div className={`mc-kpis ${kClass}`}>{kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} note={k.note} />)}</div>;

  const byType = new Map<string, { n: number; total: number }>();
  for (const m of data.media) {
    const t = typeName(m.mediaType);
    const e = byType.get(t) ?? { n: 0, total: 0 };
    e.n++; e.total += m.likeCount + m.commentsCount; byType.set(t, e);
  }
  const formats = [...byType.entries()].map(([t, e]) => ({ type: t, avg: e.total / e.n })).sort((a, b) => b.avg - a.avg);
  const fmax = Math.max(...formats.map((f) => f.avg), 1);
  const reels = data.media.filter((m) => m.mediaType === "VIDEO");

  const growth = data.snapshots.map((s) => s.followers);
  const demo = data.demographics?.entries ?? [];
  const dmax = Math.max(...demo.map((d) => d.value), 1);

  const igInsight = !data.media.length
    ? "No posts yet — publish your first and the read starts here."
    : formats.length
      ? `${formats[0].type} posts lead engagement (${formats[0].avg.toFixed(1)} avg). ${data.reach28 !== null ? `28-day reach is ${fmt(data.reach28)}` : "Reach builds as you post"} — keep the cadence steady and lean into what performs.`
      : `${fmt(data.followers)} followers and building — post consistently to compound reach.`;

  const recentPosts = (limit: number) => (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Recent posts</h3><p className="mc-sub">Likes, comments, reach — live</p></div></div>
      <div style={{ marginTop: 3 }}>
        {data.media.length ? data.media.slice(0, limit).map((m) => {
          const src = m.mediaType === "VIDEO" ? m.thumbnailUrl : (m.mediaUrl ?? m.thumbnailUrl);
          return (
            <div key={m.id} className="mc-content">
              {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: "cover", flex: "none", border: "1px solid var(--mc-hair)" }} />
                : <span className="mc-thumb">{typeName(m.mediaType)}</span>}
              <div className="mc-ct">
                <b>{m.caption || "(no caption)"}</b>
                <span>{fmtDate(m.timestamp)} · {typeName(m.mediaType)} · ♥ {fmt(m.likeCount)} · 💬 {fmt(m.commentsCount)}{m.reach !== null ? ` · reach ${fmt(m.reach)}` : ""}</span>
              </div>
              {m.permalink ? <a className="mc-viewall" href={m.permalink} target="_blank" rel="noopener noreferrer">Open ↗</a> : null}
            </div>
          );
        }) : <p className="mc-soft" style={{ fontSize: 11 }}>No posts on the account yet.</p>}
      </div>
    </div>
  );

  const formatCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Format performance</h3><p className="mc-sub">Avg engagement / post</p></div></div>
      {formats.length ? formats.map((f) => (
        <div key={f.type} className="mc-hbar">
          <span className="mc-n">{f.type}</span>
          <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.round((f.avg / fmax) * 100)}%` }} /></div>
          <span className="mc-v">{f.avg.toFixed(1)}</span>
        </div>
      )) : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>No posts yet.</p>}
    </div>
  );

  const growthCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Follower growth</h3><p className="mc-sub">Since tracking began</p></div></div>
      {growth.length >= 2
        ? <><Spark data={growth} color="var(--s-instagram)" /><p className="mc-fnote">{fmt(data.followers)} followers today</p></>
        : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>Growth builds from today — a snapshot is saved each visit.</p>}
    </div>
  );

  const demoCard = (
    <div className="mc-card mc-panel">
      <div className="mc-ph"><div><h3>Follower demographics</h3><p className="mc-sub">By country</p></div></div>
      {demo.length ? demo.slice(0, 6).map((e) => (
        <div key={e.name} className="mc-hbar wide">
          <span className="mc-n" title={e.name}>{e.name}</span>
          <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.round((e.value / dmax) * 100)}%` }} /></div>
          <span className="mc-v">{fmt(e.value)}</span>
        </div>
      )) : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>Instagram unlocks demographics past ~100 followers.</p>}
    </div>
  );

  function report() {
    const rows = kpis.map((k) => [k.label, k.value]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Instagram report — @${data.username}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0b0f;max-width:720px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0 0 2px}.sub{color:#6e6f78;font-size:13px;margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:9px 6px;border-bottom:1px solid #eee}td:last-child{text-align:right;font-weight:600}h2{font-size:14px;margin:22px 0 6px}li{font-size:13px;margin:3px 0}.hint{color:#9a9ba4;font-size:11px;margin-top:24px}@media print{body{margin:0}}</style></head>
<body><h1>Instagram — @${data.username}</h1><p class="sub">Report · generated ${new Date().toLocaleDateString("en-GB")}</p>
<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
<h2>Format performance (avg engagement/post)</h2><ul>${formats.map((f) => `<li>${f.type}: ${f.avg.toFixed(1)}</li>`).join("") || "<li>No posts yet</li>"}</ul>
<h2>Recent posts</h2><ol>${data.media.slice(0, 5).map((m) => `<li>${(m.caption || "(no caption)").slice(0, 90).replace(/</g, "&lt;")} — ${typeName(m.mediaType)}, ♥ ${fmt(m.likeCount)}${m.reach !== null ? `, reach ${fmt(m.reach)}` : ""}</li>`).join("") || "<li>No posts yet</li>"}</ol>
<p class="hint">SwissWiper · live from Instagram. Open this file and print to PDF (Ctrl/Cmd+P → Save as PDF).</p>
</body></html>`;
    downloadHtml(`instagram-report-${new Date().toISOString().slice(0, 10)}.html`, html);
  }

  const body = (() => {
    switch (section) {
      case "content":
        return <section className="mc-zone"><Head n="02" title="Content" note="recent posts & formats" /><div className="mc-split">{recentPosts(8)}{formatCard}</div></section>;
      case "analytics":
        return (
          <section className="mc-zone">
            <Head n="02" title="Analytics" note="28-day account metrics" ctx="From Instagram Insights" />
            <div className={`mc-kpis ${kClass}`}>
              <KpiCard label="Reach · 28d" value={data.reach28 !== null ? fmt(data.reach28) : "—"} note={data.reach28 !== null ? undefined : "building"} />
              <KpiCard label="Views · 28d" value={data.views28 !== null ? fmt(data.views28) : "—"} note={data.views28 !== null ? undefined : "building"} />
              <KpiCard label="Profile visits · 28d" value={data.profileViews28 !== null ? fmt(data.profileViews28) : "—"} note={data.profileViews28 !== null ? undefined : "building"} />
              <KpiCard label="Accounts engaged · 28d" value={data.accountsEngaged28 !== null ? fmt(data.accountsEngaged28) : "—"} note={data.accountsEngaged28 !== null ? undefined : "building"} />
              <KpiCard label="Avg eng./post" value={fmt(data.avgEngagementPerPost)} note={`last ${data.media.length}`} />
            </div>
            <div className="mc-g2" style={{ marginTop: 3 }}>{growthCard}{formatCard}</div>
          </section>
        );
      case "audience":
        return <section className="mc-zone"><Head n="03" title="Audience" note="growth & demographics" /><div className="mc-g2">{growthCard}{demoCard}</div></section>;
      case "reports":
        return (
          <section className="mc-zone">
            <Head n="04" title="Reports" note="account snapshot" />
            <div className="mc-card mc-panel">
              <div className="mc-ph"><div><h3>Instagram report</h3><p className="mc-sub">Live snapshot of the account</p></div>
                <button className="mc-cta sm" onClick={report}>⤓&nbsp; Download</button></div>
              {kpiRow}
              <p className="mc-soft" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>Downloads a formatted report you can open and save as PDF (Ctrl/Cmd+P). Emailed and scheduled reports are next.</p>
            </div>
          </section>
        );
      case "engagement":
        return <section className="mc-zone"><Head n="" title="Engagement" /><SectionPlaceholder title="Engagement" reason="Comments and DMs are handled in the Engagement inbox, where Alfred drafts replies in your founder voice and you approve every send." cta={<a className="mc-cta sm" href="/dashboard/marketing/engagement">Open Engagement inbox →</a>} /></section>;
      case "stories":
        return <section className="mc-zone"><Head n="" title="Stories" /><SectionPlaceholder title="Stories" reason="Story insights (taps forward, exits, replies) appear here once you post Stories on @swisswiper — the API reports them per Story." /></section>;
      case "reels":
        return (
          <section className="mc-zone"><Head n="" title="Reels" note="video posts" />
            {reels.length
              ? <div className="mc-card mc-panel"><div className="mc-ph"><div><h3>Reels</h3><p className="mc-sub">Your video posts</p></div></div><div style={{ marginTop: 3 }}>{reels.slice(0, 8).map((m) => (
                  <div key={m.id} className="mc-content"><span className="mc-thumb">Reel</span><div className="mc-ct"><b>{m.caption || "(no caption)"}</b><span>{fmtDate(m.timestamp)} · ♥ {fmt(m.likeCount)} · 💬 {fmt(m.commentsCount)}{m.reach !== null ? ` · reach ${fmt(m.reach)}` : ""}</span></div>{m.permalink ? <a className="mc-viewall" href={m.permalink} target="_blank" rel="noopener noreferrer">Open ↗</a> : null}</div>
                ))}</div></div>
              : <SectionPlaceholder title="Reels" reason="No Reels on the account yet. Once you post video, plays and watch-through appear here." />}
          </section>
        );
      case "hashtags":
        return <section className="mc-zone"><Head n="" title="Hashtags" /><SectionPlaceholder title="Hashtags" reason="Per-hashtag reach isn't exposed by the Instagram API for owned posts. If it matters, I can track a chosen set manually and surface them here." /></section>;
      case "competitors":
        return <section className="mc-zone"><Head n="" title="Competitors" /><SectionPlaceholder title="Competitors" reason="Competitor benchmarking needs a source for the accounts you want to track. Tell me which to watch and I'll wire it up." /></section>;
      case "campaigns":
        return <section className="mc-zone"><Head n="" title="Campaigns" /><SectionPlaceholder title="Campaigns" reason="Paid-campaign metrics appear here once you run Instagram/Meta ads and connect the ad account." /></section>;
      default:
        // OVERVIEW — a complete executive summary of the account
        return (
          <section className="mc-zone">
            <Head n="01" title="Overview" note="executive summary" ctx="28-day metrics where Instagram provides them" />
            {kpiRow}
            <div className="mc-split">{recentPosts(3)}{formatCard}</div>
            <div className="mc-g2">{growthCard}{demoCard}</div>
            {objectives?.length ? <Objectives title="Objectives · Instagram" items={objectives} editHref="/dashboard/marketing/plan" /> : null}
          </section>
        );
    }
  })();

  return (
    <div className="mc">
      <div className="mc-head">
        <h1 className="mc-h1"><InstagramLogo size={18} /> Instagram <span>@{data.username} · live from Instagram</span></h1>
        <div className="mc-right">
          <span className="mc-badge pink">Live API</span>
          <a className="mc-cta" href="/dashboard/marketing/pipeline?channel=instagram">✦&nbsp; Create post</a>
        </div>
      </div>

      <div className="mc-card mc-nextmove">
        <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>{igInsight}</p></div></div>
      </div>

      {body}

      <style>{COCKPIT_CSS}</style>
    </div>
  );
}

function growthNote(d: IgData): string | undefined {
  if (d.snapshots.length < 2) return undefined;
  const first = d.snapshots[0];
  const delta = d.followers - first.followers;
  return `${delta >= 0 ? "+" : ""}${delta} since ${fmtDate(first.snap_date)}`;
}
