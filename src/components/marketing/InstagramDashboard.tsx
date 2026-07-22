"use client";

import { COCKPIT_CSS, Spark, fmt } from "./cockpit-ui";
import { InstagramLogo } from "./logos";

/* The Instagram channel dashboard — same compact cockpit language as the
   overview and LinkedIn, in sidebar-linked sections (#overview · #content ·
   #audience). Live from the Instagram API; honest empties where a metric
   isn't provided yet. */

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

export default function InstagramDashboard({ data }: { data: IgData }) {
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

  // format performance from recent media
  const byType = new Map<string, { n: number; total: number }>();
  for (const m of data.media) {
    const t = typeName(m.mediaType);
    const e = byType.get(t) ?? { n: 0, total: 0 };
    e.n++; e.total += m.likeCount + m.commentsCount; byType.set(t, e);
  }
  const formats = [...byType.entries()].map(([t, e]) => ({ type: t, avg: e.total / e.n })).sort((a, b) => b.avg - a.avg);
  const fmax = Math.max(...formats.map((f) => f.avg), 1);

  const growth = data.snapshots.map((s) => s.followers);
  const demo = data.demographics?.entries ?? [];
  const dmax = Math.max(...demo.map((d) => d.value), 1);

  // Alfred's Instagram-specific read
  const igInsight = !data.media.length
    ? "No posts yet — publish your first and the read starts here."
    : formats.length
      ? `${formats[0].type} posts lead engagement (${formats[0].avg.toFixed(1)} avg). ${data.reach28 !== null ? `28-day reach is ${fmt(data.reach28)}` : "Reach builds as you post"} — keep the cadence steady and lean into what performs.`
      : `${fmt(data.followers)} followers and building — post consistently to compound reach.`;

  return (
    <div className="mc">
      <div className="mc-head">
        <h1 className="mc-h1"><InstagramLogo size={18} /> Instagram <span>@{data.username} · live from Instagram</span></h1>
        <div className="mc-right"><span className="mc-badge pink">Live API</span></div>
      </div>

      {/* Alfred's read — Instagram-specific */}
      <div className="mc-card mc-nextmove">
        <div className="mc-nmtxt"><span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span><div><b>Alfred’s read</b><p>{igInsight}</p></div></div>
      </div>

      {/* OVERVIEW */}
      <section className="mc-zone" id="overview">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">01</span><h2>Overview</h2><span className="mc-zd">— account at a glance</span></div>
          <span className="mc-zctx">28-day metrics where Instagram provides them</span>
        </div>
        <div className={`mc-kpis ${kClass}`}>
          {kpis.map((k) => (
            <div key={k.label} className="mc-card mc-kpi">
              <div className="mc-ktop"><span className="mc-klbl">{k.label}</span></div>
              <span className="mc-kval">{k.value}</span>
              <span className="mc-kdelta muted">{k.note ?? " "}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CONTENT */}
      <section className="mc-zone" id="content">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">02</span><h2>Content</h2><span className="mc-zd">— recent posts &amp; formats</span></div>
        </div>
        <div className="mc-split">
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Recent posts</h3><p className="mc-sub">Likes, comments, reach — live</p></div></div>
            <div style={{ marginTop: 3 }}>
              {data.media.length ? data.media.slice(0, 6).map((m) => {
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
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="mc-zone" id="audience">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">03</span><h2>Audience</h2><span className="mc-zd">— growth &amp; demographics</span></div>
        </div>
        <div className="mc-g2">
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Follower growth</h3><p className="mc-sub">Since tracking began</p></div></div>
            {growth.length >= 2
              ? <><Spark data={growth} color="var(--s-instagram)" /><p className="mc-fnote">{fmt(data.followers)} followers today</p></>
              : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>Growth builds from today — a snapshot is saved each visit.</p>}
          </div>
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
        </div>
      </section>

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
