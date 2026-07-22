import { progress, type Objective } from "@/lib/marketing/okr";

/* Objectives / OKRs — key results as progress-to-target bars. Renders inside a
   `.mc` cockpit context (marketing overview and channel dashboards). */

const nf = (n: number) => n.toLocaleString("en-US");
const val = (v: number, unit?: string) => (unit === "%" ? v.toFixed(1) + "%" : nf(v));

export default function Objectives({
  title = "Objectives",
  objective,
  items,
  editHref,
}: {
  title?: string;
  objective?: string;
  items: Objective[];
  editHref?: string;
}) {
  return (
    <div className="mc-card mc-panel">
      <div className="mc-ph">
        <div><h3>{title}</h3>{objective ? <p className="mc-sub">{objective}</p> : null}</div>
        {editHref ? <a className="mc-viewall" href={editHref}>Edit →</a> : null}
      </div>
      <div style={{ marginTop: 9 }}>
        {items.map((it) => {
          const p = progress(it.actual, it.target);
          return (
            <div key={it.label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 11, marginBottom: 3 }}>
                <span className="mc-n" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                  {val(it.actual, it.unit)}<span className="mc-soft"> / {val(it.target, it.unit)}{it.unit === "/mo" ? "/mo" : ""}</span>
                  <span className="mc-soft"> · {Math.round(p * 100)}%</span>
                </span>
              </div>
              <div className="mc-track"><div className="mc-fill" style={{ width: `${p * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
