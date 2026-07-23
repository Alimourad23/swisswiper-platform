"use client";

import { useState } from "react";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import type { ContentPost } from "@/lib/marketing/schedule";
import type { MarketingPlan } from "@/lib/marketing/plan";
import {
  windowAgg,
  popPercent,
  decisionMakerShare,
  contentTypeBreakdown,
  bestByCTR,
  funnel,
} from "@/lib/linkedin/compute";
import { recommendedCount } from "@/lib/marketing/cadence";
import { COCKPIT_CSS } from "./cockpit-ui";
import Objectives from "./Objectives";
import type { Objective } from "@/lib/marketing/okr";

/* ─────────────────────────────────────────────────────────────────────────
   Marketing cockpit — the four-zone executive overview.
   01 Executive summary · 02 Performance · 03 Alfred's insight · 04 Planning.
   Compact-card language (small, tight, calm), natural flow with a little scroll.
   Every number is real (LinkedIn export + live Instagram + your posts/plan) or
   an honest "building / on the channel page" state — never fabricated.
   Styling is scoped to `.mc-*` classes so it can't collide with the app.
   ──────────────────────────────────────────────────────────────────────── */

export type IgLite = { username: string; followers: number; mediaCount: number; reach28: number | null; avgEngagementPerPost: number } | null;

type Props = {
  metrics: LinkedInMetrics;
  ig: IgLite;
  posts: ContentPost[];
  plan: MarketingPlan;
  objectives?: Objective[];
  objective?: string;
};

const nf = (n: number) => n.toLocaleString("en-US");
const pct1 = (n: number) => (n * 100).toFixed(1) + "%";
const monthKey = (d: string) => d.slice(0, 7);

function deltaText(cur: number, prev: number): { text: string; good: boolean } | null {
  // No prior-period baseline → it's genuinely new, not a percentage.
  if (prev <= 0) return cur > 0 ? { text: "new", good: true } : null;
  const p = popPercent(cur, prev);
  if (p === null) return null;
  const r = Math.round(p);
  // A tiny baseline makes percentages explode and mislead — show the absolute move instead.
  if (Math.abs(r) > 300) {
    const d = cur - prev;
    return { text: (d >= 0 ? "+" : "") + d.toLocaleString("en-US"), good: d >= 0 };
  }
  return { text: (r >= 0 ? "+" : "") + r + "%", good: r >= 0 };
}

export default function MarketingCockpit({ metrics, ig, posts, plan, objectives, objective }: Props) {
  const [days, setDays] = useState(30);
  const a = windowAgg(metrics, days);
  const dm = decisionMakerShare(metrics);
  const byType = contentTypeBreakdown(metrics.posts ?? []);
  const top = bestByCTR(metrics.posts ?? [], 3);

  const inquiries = 0; // manual metric — no source yet; shown as an honest empty.
  const steps = funnel(a, inquiries);

  const totalFollowers = (metrics.followersAllTime ?? 0) + (ig?.followers ?? 0);

  // ── posts-derived (real) ────────────────────────────────────────────────
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const published = posts.filter((p) => p.status === "published");
  const publishedThisMonth = published.filter(
    (p) => p.scheduled_for && monthKey(p.scheduled_for) === thisMonth,
  ).length;
  const plannedThisMonth = posts.filter(
    (p) => p.scheduled_for && monthKey(p.scheduled_for) === thisMonth && p.status !== "idea",
  ).length;
  const failed = posts.filter((p) => (p as { publish_status?: string }).publish_status === "failed").length;
  const target = recommendedCount("linkedin") + recommendedCount("instagram"); // combined monthly target
  const upcoming = scheduled
    .filter((p) => p.scheduled_for)
    .sort((x, y) => (x.scheduled_for! < y.scheduled_for! ? -1 : 1))
    .slice(0, 5);

  // ── KPI deltas (real, vs previous window) ─────────────────────────────────
  const dImp = deltaText(a.impressions, a.prev.impressions);
  const dEng = deltaText(a.engagementRate, a.prev.engagementRate);
  const dClk = deltaText(a.clicks, a.prev.clicks);
  const dViews = deltaText(a.pageViews, a.prev.pageViews);

  // ── trend series: real daily LinkedIn impressions over the window ─────────
  const content = [...(metrics.daily?.content ?? [])].sort((x, y) => (x.date < y.date ? -1 : 1));
  const series = content.slice(-days).map((d) => (d.impOrg ?? 0) + (d.impSpon ?? 0));

  // ── insights (real-derived) ───────────────────────────────────────────────
  const insights: { chip: string; bg: string; fg: string; title: string; body: string }[] = [];
  const video = byType.find((t) => t.type === "Video");
  const text = byType.find((t) => t.type === "Text / Image");
  if (video && text && video.count >= 1 && video.avgEngagement > text.avgEngagement * 1.2) {
    insights.push({
      chip: "▶", bg: "var(--a-pink-bg)", fg: "var(--a-pink)",
      title: "Video is outperforming",
      body: `Video averages ${pct1(video.avgEngagement)} engagement vs ${pct1(text.avgEngagement)} for text/image — lean into video.`,
    });
  }
  if (dm.pct >= 0.3) {
    insights.push({
      chip: "◈", bg: "var(--a-peri-bg)", fg: "var(--a-peri)",
      title: "1 in 3 followers is a decision-maker",
      body: `${Math.round(dm.pct * 100)}% of your LinkedIn followers are director-level or above — protect this ratio as you grow.`,
    });
  }
  insights.push({
    chip: "▲", bg: "var(--a-blue-bg)", fg: "var(--a-blue)",
    title: "Engagement rate is strong",
    body: `${pct1(a.engagementRate)} over the last ${days} days — several times the norm for a page this size.`,
  });
  if (ig) {
    insights.push({
      chip: "◎", bg: "var(--a-pink-bg)", fg: "var(--a-pink)",
      title: "Instagram is live",
      body: `@${ig.username} — ${nf(ig.followers)} followers${ig.reach28 != null ? `, ${nf(ig.reach28)} reach in 28 days` : ""}, ${ig.avgEngagementPerPost.toFixed(1)} avg engagement per post.`,
    });
  } else {
    insights.push({
      chip: "◷", bg: "var(--a-amber-bg)", fg: "var(--a-amber)",
      title: "Connect Instagram for the full picture",
      body: `Reach, saves and demographics light up here once @swisswiper is connected.`,
    });
  }
  const shown = insights.slice(0, 4);

  const planReady = Object.values(plan).some((v) => v && v.trim().length > 0);

  return (
    <div className="mc">
      {/* ── header ── */}
      <div className="mc-head">
        <div>
          <h1 className="mc-h1">Marketing<span> Everything across your channels — one glance</span></h1>
        </div>
        <div className="mc-right">
          <div className="mc-toggle">
            {[7, 30, 365].map((d) => (
              <button key={d} className={d === days ? "on" : ""} onClick={() => setDays(d)}>
                {d === 365 ? "365d" : d + "d"}
              </button>
            ))}
          </div>
          <a className="mc-cta" href="/dashboard/marketing/plan">✦&nbsp; Ask Alfred</a>
        </div>
      </div>

      {/* ══ ZONE 1 · EXECUTIVE SUMMARY ══ */}
      <section className="mc-zone">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">01</span><h2>Executive summary</h2><span className="mc-zd">— the period in six numbers</span></div>
          <span className="mc-zctx">Last {days} days</span>
        </div>
        <div className="mc-kpis">
          <Kpi chip="❥" bg="var(--a-peri-bg)" fg="var(--a-peri)" label={<>Followers<br/>all channels</>} value={nf(totalFollowers)} delta={{ text: `+${a.newFollowers} this period`, good: true }} />
          <Kpi chip="◉" bg="var(--a-blue-bg)" fg="var(--a-blue)" label={<>Impressions<br/>{days}d · LinkedIn</>} value={nf(a.impressions)} delta={dImp} />
          <Kpi chip="♥" bg="var(--a-teal-bg)" fg="var(--a-teal)" label={<>Engagement<br/>rate</>} value={pct1(a.engagementRate)} delta={dEng} />
          <Kpi chip="→" bg="var(--a-pink-bg)" fg="var(--a-pink)" label={<>Post clicks<br/>{days}d</>} value={nf(a.clicks)} delta={dClk} />
          <Kpi chip="⌂" bg="var(--a-amber-bg)" fg="var(--a-amber)" label={<>Page visits<br/>{days}d</>} value={nf(a.pageViews)} delta={dViews} />
          <Kpi chip="✦" bg="var(--a-peri-bg)" fg="var(--a-peri)" label={<>Inquiries<br/>commissions</>} value={inquiries ? nf(inquiries) : "—"} delta={null} muted={!inquiries} />
        </div>
      </section>

      {/* ══ ZONE 2 · PERFORMANCE ══ */}
      <section className="mc-zone">
        <div className="mc-zhead">
          <div className="mc-zt"><span className="mc-znum">02</span><h2>Performance</h2><span className="mc-zd">— how those numbers came to be</span></div>
          <a className="mc-viewall" href="/dashboard/marketing/linkedin">Channel dashboards →</a>
        </div>

        <div className="mc-perfA">
          {/* funnel */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Marketing funnel</h3><p className="mc-sub">LinkedIn · ends at inquiries, not vanity revenue</p></div></div>
            <div className="mc-funnel">
              {steps.map((s, i) => {
                const wmax = steps[0].value || 1;
                // Scale to 72% max so the value label always has room to the right.
                const w = Math.max(18, Math.round((s.value / wmax) * 72));
                // Only show a conversion % when it's a meaningful step-down (0–100%).
                const showPct = s.ofPrevious != null && s.ofPrevious > 0 && s.ofPrevious <= 1;
                return (
                  <div key={s.label} className="mc-frow">
                    <div className="mc-fstage" style={{ width: `${w}%`, background: `var(--o${i + 1})` }}>{s.label}</div>
                    <span className="mc-fval">{nf(s.value)}{showPct ? ` · ${(s.ofPrevious! * 100).toFixed(1)}%` : ""}{s.manual ? " · manual" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* trend */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Impressions over time</h3><p className="mc-sub">LinkedIn · daily, last {days} days</p></div></div>
            <Spark data={series} />
            <p className="mc-fnote" style={{ textAlign: "left" }}>{nf(a.impressions)} impressions · {a.newFollowers >= 0 ? "+" : ""}{a.newFollowers} new followers this period</p>
          </div>

          {/* channels */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Channel performance</h3><p className="mc-sub">Only channels you run</p></div></div>
            <table className="mc-tbl">
              <thead><tr><th>Channel</th><th>Foll.</th><th>Eng.</th><th>Reach</th></tr></thead>
              <tbody>
                <tr><td><span className="mc-ctile" style={{ background: "var(--s-linkedin)" }}>in</span>LinkedIn</td><td>{nf(metrics.followersAllTime ?? 0)}</td><td>{pct1(a.engagementRate)}</td><td>{nf(a.impressions)}</td></tr>
                <tr><td><span className="mc-ctile" style={{ background: "var(--s-instagram)" }}>◎</span>Instagram</td>{ig ? (<><td>{nf(ig.followers)}</td><td>{ig.avgEngagementPerPost ? ig.avgEngagementPerPost.toFixed(1) : "—"}</td><td>{ig.reach28 != null ? nf(ig.reach28) : "—"}</td></>) : (<td colSpan={3} className="mc-soft">not connected yet</td>)}</tr>
                <tr className="mc-soonrow"><td><span className="mc-ctile" style={{ background: "var(--peri)" }}>◍</span>Website</td><td colSpan={2} className="mc-soft">analytics with revamp</td><td><a className="mc-viewall" href="https://swisswiper.com/" target="_blank" rel="noopener">Visit ↗</a></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mc-perfB">
          {/* top content */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Top content</h3><p className="mc-sub">LinkedIn · by engagement</p></div></div>
            <div style={{ marginTop: 3 }}>
              {top.length ? top.slice(0, 2).map((p, i) => (
                <div key={i} className="mc-content">
                  <span className={"mc-thumb" + (i === 1 ? " alt" : "")}>{(p.contentType || "POST").slice(0, 10)}</span>
                  <div className="mc-ct"><b>{p.title || "(untitled)"}</b><span><span className="mc-dot" style={{ background: "var(--s-linkedin)" }} />LinkedIn</span></div>
                  <span className="mc-m">{pct1(p.engagementRate)}</span>
                </div>
              )) : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>Upload a LinkedIn export to see top posts.</p>}
            </div>
          </div>

          {/* format performance */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Format performance</h3><p className="mc-sub">Avg engagement · LinkedIn</p></div></div>
            {byType.length ? byType.map((t) => {
              const max = Math.max(...byType.map((x) => x.avgEngagement), 0.0001);
              return (
                <div key={t.type} className="mc-hbar">
                  <span className="mc-n">{t.type === "Text / Image" ? "Text/Img" : t.type}</span>
                  <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.round((t.avgEngagement / max) * 100)}%` }} /></div>
                  <span className="mc-v">{pct1(t.avgEngagement)}</span>
                </div>
              );
            }) : <p className="mc-soft" style={{ fontSize: 11, marginTop: 8 }}>No post-level data yet.</p>}
          </div>

          {/* conversations */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Conversations</h3><p className="mc-sub">Every reply human-approved</p></div></div>
            <div className="mc-statgrid">
              <div className="mc-stat"><span className="mc-sv">Live</span><span className="mc-sl">Engagement inbox</span></div>
              <div className="mc-stat"><span className="mc-sv">{ig ? "On" : "—"}</span><span className="mc-sl">Instagram DMs</span></div>
            </div>
            <a className="mc-viewall" style={{ display: "inline-block", marginTop: 10 }} href="/dashboard/marketing/engagement">Open inbox →</a>
          </div>

          {/* publishing health */}
          <div className="mc-card mc-panel">
            <div className="mc-ph"><div><h3>Publishing health</h3><p className="mc-sub">This month</p></div></div>
            <div className="mc-ops">
              <div><b>{scheduled.length}</b><span>scheduled</span></div>
              <div className="ok"><b>{publishedThisMonth}</b><span>published</span></div>
              <div><b>{failed}</b><span>failed</span></div>
            </div>
            <div className="mc-hbar" style={{ marginTop: 9 }}>
              <span className="mc-n">Cadence</span>
              <div className="mc-track"><div className="mc-fill" style={{ width: `${Math.min(100, Math.round((plannedThisMonth / (target || 1)) * 100))}%` }} /></div>
              <span className="mc-v">{plannedThisMonth}/{target}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ZONE 3 + ZONE 4 ══ */}
      <div className="mc-split">
        <section className="mc-zone">
          <div className="mc-zhead">
            <div className="mc-zt"><span className="mc-znum">03</span><h2>Alfred’s insight</h2><span className="mc-zd">— his read on the numbers</span></div>
          </div>
          <div className="mc-insights">
            {shown.map((it, i) => (
              <div key={i} className="mc-card mc-insight">
                <span className="mc-chip" style={{ background: it.bg, color: it.fg }}>{it.chip}</span>
                <div><b>{it.title}</b><span>{it.body}</span></div>
              </div>
            ))}
          </div>
          <div className="mc-card mc-nextmove">
            <div className="mc-nmtxt">
              <span className="mc-chip" style={{ background: "var(--a-peri-bg)", color: "var(--a-peri)" }}>✦</span>
              <div><b>Alfred’s next move</b><p>{plannedThisMonth < target ? `This month is light — ${plannedThisMonth} of ${target} recommended posts planned. Draft the rest around what performed?` : `You’re on cadence this month. Want Alfred to line up next month?`}</p></div>
            </div>
            <a className="mc-cta sm" href="/dashboard/marketing/plan">✦&nbsp; Plan with Alfred</a>
          </div>
        </section>

        <section className="mc-zone">
          <div className="mc-zhead">
            <div className="mc-zt"><span className="mc-znum">04</span><h2>Planning</h2><span className="mc-zd">— progress &amp; what’s next</span></div>
            <a className="mc-viewall" href="/dashboard/marketing/plan">Full plan →</a>
          </div>
          {objectives?.length ? (
            <Objectives title="Objectives" objective={objective} items={objectives} editHref="/dashboard/marketing/plan" />
          ) : null}
          <div className="mc-card mc-panel">
            <div className="mc-ringrow">
              <Ring pct={Math.min(1, plannedThisMonth / (target || 1))} label={`${Math.round((plannedThisMonth / (target || 1)) * 100)}%`} />
              <div className="mc-obj">
                <div className="mc-o"><span>Posts vs cadence</span><b>{plannedThisMonth} / {target}</b></div>
                <div className="mc-o"><span>Decision-makers</span><b>{dm.dm} of {dm.total}</b></div>
                <div className="mc-o"><span>Plan</span><b>{planReady ? "Set" : "Draft it →"}</b></div>
              </div>
            </div>
            <div style={{ marginTop: 9, borderTop: "1px solid var(--mc-hair)", paddingTop: 7 }}>
              {upcoming.length ? upcoming.slice(0, 4).map((p) => {
                const d = p.scheduled_for ? new Date(p.scheduled_for + "T00:00:00") : null;
                const mon = d ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "";
                const day = d ? d.getDate() : "";
                const col = p.channel === "instagram" ? "var(--s-instagram)" : "var(--s-linkedin)";
                return (
                  <div key={p.id} className="mc-act">
                    <span className="mc-d">{mon}<b>{day}</b></span>
                    <span className="mc-t"><span className="mc-dot" style={{ background: col }} />{p.title || "(untitled)"}</span>
                  </div>
                );
              }) : <p className="mc-soft" style={{ fontSize: 11 }}>No scheduled posts yet — <a className="mc-viewall" href="/dashboard/marketing/pipeline">plan some →</a></p>}
            </div>
          </div>
        </section>
      </div>

      <p className="mc-foot">Real numbers at current scale — panels earn their place as data arrives.</p>

      <style>{COCKPIT_CSS}</style>
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────────── */

function Kpi({ chip, bg, fg, label, value, delta, muted }: {
  chip: string; bg: string; fg: string; label: React.ReactNode; value: string;
  delta: { text: string; good: boolean } | null; muted?: boolean;
}) {
  return (
    <div className="mc-card mc-kpi">
      <div className="mc-ktop"><span className="mc-chip" style={{ background: bg, color: fg }}>{chip}</span><span className="mc-klbl">{label}</span></div>
      <span className="mc-kval" style={muted ? { color: "var(--mc-hint)" } : undefined}>{value}</span>
      {delta ? <span className="mc-kdelta" style={delta.good ? undefined : { color: "var(--mc-hint)" }}>{delta.text}</span> : <span className="mc-kdelta muted">—</span>}
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const W = 240, H = 60, P = 6;
  if (!data.length) return <div style={{ height: H, display: "grid", placeItems: "center", fontSize: 11, color: "var(--mc-hint)" }}>No trend yet</div>;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (Math.max(1, data.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const area = line + ` L${x(data.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", marginTop: 6 }} preserveAspectRatio="none">
      <path d={area} fill="var(--peri-deep)" opacity="0.08" />
      <path d={line} fill="none" stroke="var(--peri-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="mc-ring">
      <svg width="62" height="62" viewBox="0 0 62 62">
        <circle cx="31" cy="31" r={R} fill="none" stroke="var(--peri-soft)" strokeWidth="8" />
        <circle cx="31" cy="31" r={R} fill="none" stroke="var(--peri-deep)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 31 31)" />
      </svg>
      <span className="mc-rc">{label}</span>
    </div>
  );
}
