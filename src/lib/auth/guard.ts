import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole, withAccessDefaults, isManager, type Role } from "@/lib/auth/roles";

/* Server-side access enforcement for the dashboard.
   - getAccess(): the signed-in user's role, status and allowed module keys.
   - guardModule(key): call at the top of a module layout; redirects anyone
     without access back to the Overview (founders always pass). */

export type Access = {
  userId: string | null;
  role: Role;
  status: string; // active | deactivated
  allowed: string[]; // module keys this role may open
  manager: boolean; // founder | admin
};

export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, role: "viewer", status: "active", allowed: [], manager: false };
  }
  // Read `role` on its own — it always exists. `status` and the access policy
  // come from the admin-panel migration; if it hasn't run yet those queries just
  // return null and we fall back to sane defaults (so nobody is ever locked out
  // by a missing column).
  const [{ data: roleRow }, { data: statusRow }, { data: cfg }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    supabase.from("admin_config").select("data").eq("id", "access").maybeSingle(),
  ]);
  const role = normalizeRole((roleRow as { role?: string } | null)?.role);
  const status = (statusRow as { status?: string } | null)?.status || "active";
  const policy = withAccessDefaults((cfg as { data?: Record<string, string[]> } | null)?.data ?? null);
  const allowed = policy[role] ?? [];
  return { userId: user.id, role, status, allowed, manager: isManager(role) };
}

export async function guardModule(key: string): Promise<void> {
  const a = await getAccess();
  if (!a.userId) return; // auth gate (proxy) handles anonymous users
  if (a.status === "deactivated") redirect("/dashboard/overview"); // layout shows the blocked screen there
  if (a.role === "founder") return;
  if (!a.allowed.includes(key)) redirect("/dashboard/overview");
}
