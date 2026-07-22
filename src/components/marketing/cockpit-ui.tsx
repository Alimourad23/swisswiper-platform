"use client";

/* Shared cockpit visual system — the ONE source of truth for the marketing
   overview and every channel page, so they all match "UI direction v6" exactly.
   Compact-card language: small, tight, calm. Scoped to `.mc-*`. */

export const COCKPIT_CSS = `
.mc { --mc-page:#f5f6f9; --mc-surface:#fff; --mc-ink:#0b0b0f; --mc-muted:#52514e; --mc-hint:#9a9ba4; --mc-hair:rgba(11,11,15,0.07);
  --peri:#cad1e8; --peri-soft:#eef1f8; --peri-deep:#5c66a6; --peri-deeper:#454f8a;
  --s-linkedin:#0a66c2; --s-instagram:#c2367b;
  --a-blue:#0a66c2; --a-blue-bg:#e8f0fa; --a-pink:#c2367b; --a-pink-bg:#faeaf2; --a-teal:#0f766e; --a-teal-bg:#e6f3f1; --a-amber:#b45309; --a-amber-bg:#faf0e4; --a-peri:#5c66a6; --a-peri-bg:#eef1f8;
  --o1:#9aa6d0; --o2:#7a88bb; --o3:#5c66a6; --o4:#454f8a; --o5:#333c6e; --good:#047857;
  color:var(--mc-ink); display:flex; flex-direction:column; gap:13px; }
.mc *{ box-sizing:border-box; }
.mc-head{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
.mc-h1{ font-size:19px; font-weight:500; margin:0; letter-spacing:-0.01em; display:flex; align-items:center; gap:9px; }
.mc-h1 span{ color:var(--mc-hint); font-weight:400; font-size:13px; margin-left:0; }
.mc-right{ display:flex; align-items:center; gap:9px; }
.mc-badge{ font-size:10px; font-weight:600; padding:3px 8px; border-radius:999px; background:var(--peri-soft); color:var(--peri-deep); }
.mc-badge.blue{ background:var(--a-blue-bg); color:var(--a-blue); }
.mc-badge.pink{ background:var(--a-pink-bg); color:var(--a-pink); }
.mc-toggle{ display:flex; background:var(--mc-surface); border:1px solid var(--mc-hair); border-radius:999px; padding:2px; }
.mc-toggle button{ border:0; background:transparent; font:inherit; font-size:11px; font-weight:500; color:var(--mc-muted); padding:4px 11px; border-radius:999px; cursor:pointer; }
.mc-toggle button.on{ background:var(--peri-soft); color:var(--peri-deep); }
.mc-cta{ background:var(--peri-deep); color:#fff; border:0; font:inherit; font-size:11.5px; font-weight:500; padding:7px 14px; border-radius:999px; cursor:pointer; white-space:nowrap; text-decoration:none; display:inline-block; }
.mc-cta:hover{ background:var(--peri-deeper); }
.mc-cta.sm{ padding:6px 11px; }
.mc-card{ background:var(--mc-surface); border:1px solid var(--mc-hair); border-radius:13px; box-shadow:0 1px 2px rgba(11,11,15,0.03); min-width:0; }
.mc-chip{ flex:none; width:22px; height:22px; border-radius:7px; display:grid; place-items:center; font-size:11px; }
.mc-zone{ display:flex; flex-direction:column; gap:8px; min-width:0; scroll-margin-top:16px; }
.mc-zhead{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:0 1px 5px; border-bottom:1px solid var(--mc-hair); }
.mc-zt{ display:flex; align-items:baseline; gap:9px; min-width:0; }
.mc-znum{ font-size:10px; font-weight:700; letter-spacing:0.14em; color:var(--peri-deep); }
.mc-zt h2{ margin:0; font-size:14px; font-weight:600; letter-spacing:-0.01em; }
.mc-zd{ font-size:11px; color:var(--mc-muted); }
.mc-zctx{ font-size:10.5px; color:var(--mc-hint); }
.mc-viewall{ font-size:11px; color:var(--peri-deep); text-decoration:none; font-weight:500; white-space:nowrap; }
.mc-viewall:hover{ text-decoration:underline; }
.mc-kpis{ display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
.mc-kpis.k4{ grid-template-columns:repeat(4,minmax(0,1fr)); }
.mc-kpis.k5{ grid-template-columns:repeat(5,minmax(0,1fr)); }
.mc-kpi{ padding:9px 11px 8px; display:flex; flex-direction:column; gap:0; }
.mc-ktop{ display:flex; align-items:center; gap:7px; margin-bottom:5px; }
.mc-klbl{ font-size:9.5px; color:var(--mc-hint); font-weight:500; line-height:1.2; }
.mc-kval{ font-size:18px; font-weight:500; letter-spacing:-0.01em; }
.mc-kdelta{ font-size:9.5px; font-weight:500; color:var(--good); }
.mc-kdelta.muted{ color:var(--mc-hint); }
.mc-perfA{ display:grid; grid-template-columns:minmax(0,3.7fr) minmax(0,4.6fr) minmax(0,3.7fr); gap:11px; }
.mc-perfB{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }
.mc-split{ display:grid; grid-template-columns:minmax(0,6.6fr) minmax(0,4.4fr); gap:14px; align-items:start; }
.mc-g2{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
.mc-g3{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:11px; }
.mc-panel{ min-width:0; padding:11px 13px 10px; }
.mc-ph{ display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.mc-panel h3{ margin:0; font-size:12.5px; font-weight:500; }
.mc-sub{ margin:1px 0 0; font-size:10px; color:var(--mc-hint); }
.mc-funnel{ display:flex; flex-direction:column; gap:5px; margin-top:10px; }
.mc-frow{ display:flex; align-items:center; gap:8px; }
.mc-fstage{ height:22px; display:flex; align-items:center; padding:0 9px; color:#fff; font-size:10px; font-weight:500; border-radius:5px; min-width:88px; white-space:nowrap; flex:none; }
.mc-fval{ font-size:9.5px; color:var(--mc-muted); white-space:nowrap; }
.mc-fnote{ margin-top:8px; font-size:10px; color:var(--mc-hint); }
.mc-tbl{ width:100%; border-collapse:collapse; margin-top:5px; font-size:11px; }
.mc-tbl th{ text-align:left; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:var(--mc-hint); font-weight:500; padding:5px 5px; border-bottom:1px solid var(--mc-hair); }
.mc-tbl td{ padding:6px 5px; border-bottom:1px solid var(--mc-hair); }
.mc-tbl td:first-child{ white-space:nowrap; }
.mc-tbl tr:last-child td{ border-bottom:0; }
.mc-soft{ color:var(--mc-hint); }
.mc-ctile{ display:inline-grid; place-items:center; width:19px; height:19px; border-radius:5px; color:#fff; font-size:9px; font-weight:700; margin-right:7px; vertical-align:middle; }
.mc-content{ display:flex; gap:9px; align-items:center; padding:6px 0; border-bottom:1px solid var(--mc-hair); }
.mc-content:last-child{ border-bottom:0; }
.mc-thumb{ width:30px; height:30px; border-radius:7px; background:var(--mc-ink); color:#fff; font-size:5px; display:grid; place-items:center; text-align:center; line-height:1.4; font-weight:700; letter-spacing:0.03em; padding:2px; flex:none; }
.mc-thumb.alt{ background:var(--peri-soft); color:var(--peri-deep); }
.mc-ct{ flex:1; min-width:0; }
.mc-ct b{ display:block; font-size:11px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mc-ct span{ font-size:9.5px; color:var(--mc-hint); }
.mc-m{ font-size:10.5px; font-weight:500; white-space:nowrap; }
.mc-dot{ display:inline-block; width:6px; height:6px; border-radius:999px; margin-right:6px; vertical-align:1px; }
.mc-hbar{ display:grid; grid-template-columns:56px 1fr 42px; gap:7px; align-items:center; font-size:10.5px; margin-top:7px; }
.mc-hbar.wide{ grid-template-columns:118px 1fr 46px; }
.mc-n{ color:var(--mc-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mc-track{ height:12px; border-radius:4px; background:var(--peri-soft); overflow:hidden; }
.mc-fill{ height:100%; border-radius:4px; background:var(--peri-deep); }
.mc-v{ text-align:right; font-weight:500; }
.mc-statgrid{ display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; margin-top:9px; }
.mc-stat{ display:flex; flex-direction:column; gap:0; }
.mc-sv{ font-size:15px; font-weight:500; line-height:1.1; }
.mc-sl{ font-size:9.5px; color:var(--mc-hint); }
.mc-ops{ display:flex; margin-top:9px; border:1px solid var(--mc-hair); border-radius:9px; overflow:hidden; }
.mc-ops div{ flex:1; padding:6px 9px; border-right:1px solid var(--mc-hair); }
.mc-ops div:last-child{ border-right:0; }
.mc-ops b{ display:block; font-size:14px; font-weight:500; }
.mc-ops span{ font-size:9px; color:var(--mc-hint); }
.mc-ops .ok b{ color:var(--good); }
.mc-insights{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.mc-insight{ padding:9px 11px; display:flex; gap:8px; align-items:flex-start; }
.mc-insight b{ display:block; font-size:11px; font-weight:500; margin-bottom:1px; line-height:1.25; }
.mc-insight span{ font-size:9.5px; color:var(--mc-muted); line-height:1.4; }
.mc-nextmove{ display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 13px; background:linear-gradient(180deg,#fff 0%,var(--peri-soft) 260%); }
.mc-nmtxt{ display:flex; gap:9px; align-items:center; min-width:0; }
.mc-nmtxt b{ font-size:11.5px; font-weight:600; }
.mc-nmtxt p{ margin:1px 0 0; font-size:10.5px; color:var(--mc-muted); line-height:1.4; }
.mc-hero{ display:flex; align-items:center; justify-content:space-between; gap:14px; }
.mc-hero .hv{ font-size:34px; font-weight:600; letter-spacing:-0.02em; line-height:1; }
.mc-hero .hl{ font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--mc-hint); font-weight:500; margin-bottom:6px; }
.mc-hero p{ margin:7px 0 0; font-size:11px; color:var(--mc-muted); line-height:1.45; max-width:320px; }
.mc-ringrow{ display:flex; align-items:center; gap:11px; margin-top:2px; }
.mc-ring{ position:relative; width:62px; height:62px; flex:none; }
.mc-ring.lg{ width:96px; height:96px; }
.mc-rc{ position:absolute; inset:0; display:grid; place-items:center; font-size:13px; font-weight:500; }
.mc-ring.lg .mc-rc{ font-size:19px; }
.mc-obj{ display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; }
.mc-o{ display:flex; justify-content:space-between; gap:8px; font-size:10.5px; color:var(--mc-muted); }
.mc-o b{ font-weight:500; color:var(--mc-ink); white-space:nowrap; }
.mc-act{ display:flex; gap:8px; padding:5px 0; border-bottom:1px solid var(--mc-hair); align-items:center; font-size:11px; }
.mc-act:last-child{ border-bottom:0; }
.mc-d{ width:34px; flex:none; text-align:center; background:var(--peri-soft); color:var(--peri-deep); border-radius:6px; padding:2px 0; font-size:8.5px; font-weight:500; line-height:1.25; }
.mc-d b{ display:block; font-size:11.5px; }
.mc-t{ flex:1; min-width:0; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mc-foot{ text-align:center; font-size:9.5px; color:var(--mc-hint); margin:2px 0 0; }
@media (max-width:1100px){ .mc-perfA,.mc-perfB,.mc-split,.mc-g2,.mc-g3{ grid-template-columns:1fr; } .mc-kpis,.mc-kpis.k4,.mc-kpis.k5{ grid-template-columns:repeat(3,1fr); } .mc-insights{ grid-template-columns:1fr; } }
`;

export const fmt = (n: number) => n.toLocaleString("en-US");
export const pct1 = (n: number) => (n * 100).toFixed(1) + "%";

/** Shared area sparkline / trend line. */
export function Spark({ data, color = "var(--peri-deep)", h = 60 }: { data: number[]; color?: string; h?: number }) {
  const W = 240, P = 6;
  if (!data.length) return <div style={{ height: h, display: "grid", placeItems: "center", fontSize: 11, color: "var(--mc-hint)" }}>No trend yet</div>;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);
  const y = (v: number) => h - P - ((v - min) / span) * (h - 2 * P);
  const line = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const area = line + ` L${x(data.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} style={{ display: "block", marginTop: 6 }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Shared progress ring. size: 62 (default) or 96 (large). */
export function Ring({ pct, label, size = 62 }: { pct: number; label: string; size?: number }) {
  const c = size / 2;
  const R = size === 96 ? 40 : 26;
  const sw = size === 96 ? 9 : 8;
  const C = 2 * Math.PI * R;
  return (
    <div className={size === 96 ? "mc-ring lg" : "mc-ring"}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--peri-soft)" strokeWidth={sw} />
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--peri-deep)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${(C * Math.max(0, Math.min(1, pct))).toFixed(1)} ${C.toFixed(1)}`} transform={`rotate(-90 ${c} ${c})`} />
      </svg>
      <span className="mc-rc">{label}</span>
    </div>
  );
}
