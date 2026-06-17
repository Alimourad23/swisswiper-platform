import type { ReactNode } from "react";
import type { RankItem } from "@/lib/linkedin/parse";
import type { FunnelStep, DMShare, ContentTypeStat } from "@/lib/linkedin/compute";

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function StatCard({
  label,
  value,
  sub,
  right,
}: {
  label: string;
  value: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="sw-card px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {right}
      </div>
      <p className="mt-2 text-3xl font-medium tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-hint">{sub}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sw-card">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <h3 className="text-base font-medium">{title}</h3>
        {right}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* Simple monthly bar chart (no chart library — calm CSS bars). */
export function BarChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-hint">No data yet.</p>;
  return (
    <div className="flex items-end gap-3" style={{ height: 120 }}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-medium text-ink">{it.value}</span>
          <div
            className="w-full rounded-t-md bg-peri"
            style={{ height: `${Math.max(4, (it.value / max) * 90)}px` }}
          />
          <span className="text-[11px] text-hint">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* Proportional horizontal split (e.g. engagement breakdown). */
export function SplitBar({ segments }: { segments: { label: string; value: number }[] }) {
  const total = Math.max(1, segments.reduce((n, s) => n + s.value, 0));
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={i % 2 === 0 ? "bg-peri-deep" : "bg-peri"}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="text-sm text-muted">
            <strong className="font-medium text-ink">{fmt(s.value)}</strong> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) return <span className="text-xs text-hint">— vs prior</span>;
  const up = value >= 0;
  return (
    <span className={["text-xs font-medium", up ? "text-live" : "text-red-600"].join(" ")}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(0)}%{" "}
      <span className="font-normal text-hint">vs prior</span>
    </span>
  );
}

export function Kpi({
  label,
  value,
  delta,
  sub,
  tag,
}: {
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
  tag?: ReactNode;
}) {
  return (
    <div className="sw-card px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {tag}
      </div>
      <p className="mt-2 text-3xl font-medium tracking-tight text-ink">{value}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {delta !== undefined && <Delta value={delta} />}
        {sub && <span className="text-xs text-hint">{sub}</span>}
      </div>
    </div>
  );
}

export function DecisionMakerHero({ share }: { share: DMShare }) {
  const pct = share.pct;
  return (
    <div className="sw-card flex items-center justify-between gap-6 px-7 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-hint">Decision-maker share</p>
        <p className="mt-1 text-4xl font-medium tracking-tight text-ink">{(pct * 100).toFixed(0)}%</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          {share.dm} of {share.total} followers are director-level or above (Owner, Director, VP,
          Partner, CXO).
        </p>
      </div>
      <div
        className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--color-peri-deep) ${pct * 360}deg, var(--color-line) 0)` }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-surface text-sm font-medium text-peri-deep">
          {(pct * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="flex flex-col gap-4">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {s.label}
              {s.manual && (
                <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  manual
                </span>
              )}
            </span>
            <span className="font-medium text-ink">{fmt(s.value)}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-peri-deep" style={{ width: `${(s.value / max) * 100}%` }} />
          </div>
          {i > 0 && s.ofPrevious !== null && (
            <p className="mt-1 text-xs text-hint">
              {(s.ofPrevious * 100).toFixed(s.ofPrevious < 0.1 ? 1 : 0)}% of {steps[i - 1].label.toLowerCase()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ContentTypeBars({ stats }: { stats: ContentTypeStat[] }) {
  const max = Math.max(0.0001, ...stats.map((s) => s.avgEngagement));
  if (stats.length === 0) return <p className="text-sm text-hint">No posts yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      {stats.map((s) => (
        <div key={s.type}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {s.type} <span className="text-hint">· {s.count} {s.count === 1 ? "post" : "posts"}</span>
            </span>
            <span className="font-medium text-ink">{(s.avgEngagement * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-peri" style={{ width: `${(s.avgEngagement / max) * 100}%` }} />
          </div>
          <p className="mt-0.5 text-xs text-hint">avg CTR {(s.avgCTR * 100).toFixed(1)}%</p>
        </div>
      ))}
    </div>
  );
}

export function RankList({ title, items, unit }: { title: string; items: RankItem[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-hint">No data.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.slice(0, 6).map((it) => (
            <li key={it.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted">{it.label}</span>
                <span className="shrink-0 font-medium text-ink">{it.value}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full bg-peri" style={{ width: `${(it.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">{unit}</span>
    </div>
  );
}
