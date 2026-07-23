"use client";

import { GATED_MODULES, LEVELS, type AccessMap, type Level } from "@/lib/auth/roles";

/* A per-module Hidden / View / Edit picker. Used for a person's overrides and a
   team's template. When `inherited` is passed (the team template), modules the
   person hasn't overridden show the inherited value with a "from team" hint and
   a reset control. */

const activeClass: Record<Level, string> = {
  hidden: "bg-line text-muted",
  view: "bg-amber-500/15 text-amber-700",
  edit: "bg-peri-soft text-peri-deep",
};

export default function AccessEditor({
  value,
  onChange,
  inherited = null,
}: {
  value: AccessMap;
  onChange: (a: AccessMap) => void;
  inherited?: AccessMap | null;
}) {
  const set = (mod: string, lvl: Level | null) => {
    const next: AccessMap = { ...value };
    if (lvl === null) delete next[mod];
    else next[mod] = lvl;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {GATED_MODULES.map((m) => {
        const own = value[m.key];
        const eff: Level = own ?? inherited?.[m.key] ?? "hidden";
        const usingTeam = inherited != null && own === undefined;
        return (
          <div key={m.key} className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-ink">{m.label}</span>
              {usingTeam && <span className="text-[10px] text-hint">from team</span>}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex rounded-[var(--radius-control)] border border-hairline p-0.5">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => set(m.key, l.key)}
                    className={[
                      "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                      eff === l.key ? activeClass[l.key] : "text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {inherited != null && own !== undefined && (
                <button
                  type="button"
                  onClick={() => set(m.key, null)}
                  title="Use the team default"
                  className="grid h-6 w-6 place-items-center rounded-[8px] text-hint hover:bg-bg hover:text-ink"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
