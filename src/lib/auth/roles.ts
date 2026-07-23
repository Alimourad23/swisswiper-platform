/* Role model for the admin / control panel. Pure + client-importable (no server
   imports) so both the sidebar and the admin UI can use it. Fixed tiers:
   Founder > Admin > Member > Viewer. */

export type Role = "founder" | "admin" | "member" | "viewer";

export const ROLES: { key: Role; label: string; blurb: string }[] = [
  { key: "founder", label: "Founder", blurb: "Full control of everything, including this admin panel." },
  { key: "admin", label: "Admin", blurb: "Manage people, access and settings — everything except founder-only actions." },
  { key: "member", label: "Member", blurb: "Works in the modules they're given access to." },
  { key: "viewer", label: "Viewer", blurb: "Read-only in the modules they're given access to." },
];

export const ROLE_RANK: Record<Role, number> = { founder: 3, admin: 2, member: 1, viewer: 0 };

export function normalizeRole(r: string | null | undefined): Role {
  return r === "founder" || r === "admin" || r === "member" || r === "viewer" ? r : "member";
}

/** Can this role manage the admin panel (people, access, settings)? */
export function isManager(role: Role): boolean {
  return role === "founder" || role === "admin";
}

/* Modules that can be gated per role — keep in sync with the sidebar. */
export const MODULES: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "emails", label: "Emails" },
  { key: "calendar", label: "Calendar" },
  { key: "tasks", label: "Tasks" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
];

/** role → allowed module keys. Founder is always all (not stored). */
export type AccessPolicy = Record<Role, string[]>;

export const DEFAULT_ACCESS: AccessPolicy = {
  founder: MODULES.map((m) => m.key),
  admin: MODULES.map((m) => m.key),
  member: ["overview", "tasks", "calendar", "marketing"],
  viewer: ["overview"],
};

/** Fill any missing role with defaults; founder always gets everything. */
export function withAccessDefaults(p: Partial<AccessPolicy> | null | undefined): AccessPolicy {
  return {
    founder: MODULES.map((m) => m.key),
    admin: p?.admin ?? DEFAULT_ACCESS.admin,
    member: p?.member ?? DEFAULT_ACCESS.member,
    viewer: p?.viewer ?? DEFAULT_ACCESS.viewer,
  };
}

export function canAccess(policy: AccessPolicy, role: Role, moduleKey: string): boolean {
  if (role === "founder") return true;
  return (policy[role] ?? []).includes(moduleKey);
}
