import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeRole,
  isManager,
  effectiveLevels,
  visibleModules,
  cleanAccessMap,
  type Role,
  type Level,
} from "@/lib/auth/roles";

/* Server-side access enforcement.
   - getAccess(): the signed-in user's role, status, and per-module levels.
   - guardModule(key): call at the top of a module layout; redirects anyone whose
     level for that module is "hidden" (founders always pass). */

export type Access = {
  userId: string | null;
  role: Role;
  status: string; // active | deactivated
  levels: Record<string, Level>; // module key → hidden | view | edit
  allowed: string[]; // modules that are at least visible
  manager: boolean; // founder (super-admin)
};

export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, role: "member", status: "active", levels: {}, allowed: [], manager: false };
  }

  // Read fields separately so a not-yet-run migration (missing column) can't
  // fail the whole query and lock anyone out — each just falls back to a default.
  const [{ data: roleRow }, { data: statusRow }, { data: accessRow }, { data: teamRow }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("access").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("team_id").eq("id", user.id).maybeSingle(),
  ]);

  const role = normalizeRole((roleRow as { role?: string } | null)?.role);
  const status = (statusRow as { status?: string } | null)?.status || "active";
  const personAccess = cleanAccessMap((accessRow as { access?: unknown } | null)?.access);

  // The team's template (if any).
  let teamAccess = {};
  const teamId = (teamRow as { team_id?: string } | null)?.team_id ?? null;
  if (teamId) {
    const { data: t } = await supabase.from("teams").select("access").eq("id", teamId).maybeSingle();
    teamAccess = cleanAccessMap((t as { access?: unknown } | null)?.access);
  }

  const levels = effectiveLevels(role, personAccess, teamAccess);
  return { userId: user.id, role, status, levels, allowed: visibleModules(levels), manager: isManager(role) };
}

export async function guardModule(key: string): Promise<void> {
  const a = await getAccess();
  if (!a.userId) return; // anonymous users are handled by the auth proxy
  if (a.status === "deactivated") redirect("/dashboard/overview"); // layout shows the blocked screen
  if ((a.levels[key] ?? "hidden") === "hidden") redirect("/dashboard/overview");
}

/* May the signed-in user WRITE in this module? Used to gate mutating server
   actions so "View" is genuinely read-only (founders & baseline modules = edit). */
export async function canEditModule(key: string): Promise<boolean> {
  const a = await getAccess();
  if (!a.userId || a.status === "deactivated") return false;
  return (a.levels[key] ?? "hidden") === "edit";
}
