/* Access model for the admin / control panel. Pure + client-importable.

   Two roles:
   - Founder  = super-admin. Sees and does everything, and runs this panel.
   - Member   = access is set PER MODULE (Hidden / View / Edit), from their
                team's template and/or a per-person override.

   Everyone — regardless of role — always has the BASELINE modules
   (Overview, Emails, Calendar, Tasks, and Alfred). Those are non-negotiable. */

export type Role = "founder" | "member";

export const ROLES: { key: Role; label: string; blurb: string }[] = [
  { key: "founder", label: "Founder", blurb: "Super-admin — full access to everything, including this panel." },
  { key: "member", label: "Member", blurb: "Access is set per module (Hidden / View / Edit), by team or per person." },
];

export function normalizeRole(r: string | null | undefined): Role {
  return r === "founder" ? "founder" : "member";
}

/** Founders run the admin panel and bypass all module access. */
export function isManager(role: Role): boolean {
  return role === "founder";
}

/* All modules that appear in the sidebar. */
export const MODULES: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "emails", label: "Emails" },
  { key: "calendar", label: "Calendar" },
  { key: "tasks", label: "Tasks" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
];

/* Always-on for everyone — never gated. (Alfred is always available too.) */
export const BASELINE_MODULE_KEYS = ["overview", "emails", "calendar", "tasks"];

/* The modules whose access you actually control per person / per team. */
export const GATED_MODULES = MODULES.filter((m) => !BASELINE_MODULE_KEYS.includes(m.key));

export type Level = "hidden" | "view" | "edit";

export const LEVELS: { key: Level; label: string }[] = [
  { key: "hidden", label: "Hidden" },
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
];

/** A map of gated moduleKey → level. Missing key = hidden (member) / edit (founder). */
export type AccessMap = Record<string, Level>;

/* Resolve the effective level for EVERY module, given a person's role, their own
   override map, and their team's template map. Person override wins over team,
   team over the default (hidden). */
export function effectiveLevels(role: Role, person: AccessMap | null, team: AccessMap | null): Record<string, Level> {
  const out: Record<string, Level> = {};
  for (const m of MODULES) {
    if (BASELINE_MODULE_KEYS.includes(m.key)) { out[m.key] = "edit"; continue; }
    if (role === "founder") { out[m.key] = "edit"; continue; }
    out[m.key] = person?.[m.key] ?? team?.[m.key] ?? "hidden";
  }
  return out;
}

/** Module keys that are at least visible (View or Edit). */
export function visibleModules(levels: Record<string, Level>): string[] {
  return Object.entries(levels)
    .filter(([, l]) => l !== "hidden")
    .map(([k]) => k);
}

/** Keep only valid gated-module levels (drops junk / baseline keys). */
export function cleanAccessMap(raw: unknown): AccessMap {
  const out: AccessMap = {};
  if (raw && typeof raw === "object") {
    for (const m of GATED_MODULES) {
      const v = (raw as Record<string, unknown>)[m.key];
      if (v === "hidden" || v === "view" || v === "edit") out[m.key] = v;
    }
  }
  return out;
}
