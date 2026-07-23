"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeRole,
  isManager,
  cleanAccessMap,
  GATED_MODULES,
  type Role,
  type AccessMap,
} from "@/lib/auth/roles";
import type { Person, Team, OrgSettings, AuditEntry, PeopleView } from "@/lib/admin/types";

/* Short human summary of an access map for the audit log. */
function summarizeAccess(a: AccessMap): string {
  const parts = GATED_MODULES.map((m) => `${m.label}=${a[m.key] ?? "hidden"}`);
  return parts.join(", ");
}

/* Admin / control-panel server actions. Every privileged operation:
   1) verifies the CALLER is a founder/admin (via the normal session client), then
   2) performs the work with the SERVICE-ROLE client (so it can read every user
      and write regardless of RLS), then
   3) writes an audit-log entry.
   If the service-role key isn't configured, privileged calls return
   { reason: "no_service_role" } so the UI can show a setup note. */

type Me = { userId: string; role: Role; name: string };

async function me(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // `role` always exists; `full_name` arrives with the admin-panel migration, so
  // read it separately and fall back to auth metadata if the column isn't there.
  const [{ data: roleRow }, { data: nameRow }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = (nameRow as { full_name?: string } | null)?.full_name || meta.full_name || meta.name || user.email || "Someone";
  return { userId: user.id, role: normalizeRole((roleRow as { role?: string } | null)?.role), name };
}

type Manager =
  | { ok: true; admin: NonNullable<ReturnType<typeof createAdminClient>>; me: Me }
  | { ok: false; reason: "not_manager" | "no_service_role" };

async function manager(): Promise<Manager> {
  const ctx = await me();
  if (!ctx || !isManager(ctx.role)) return { ok: false, reason: "not_manager" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "no_service_role" };
  return { ok: true, admin, me: ctx };
}

async function audit(m: { admin: NonNullable<ReturnType<typeof createAdminClient>>; me: Me }, action: string, detail?: string) {
  try {
    await m.admin.from("audit_log").insert({ actor_id: m.me.userId, actor_name: m.me.name, action, detail: detail ?? null });
  } catch {
    /* audit is best-effort */
  }
}

/* ---- Current user ---------------------------------------------------- */

export async function getMyRole(): Promise<Role> {
  const ctx = await me();
  return ctx?.role ?? "member";
}

/* ---- People ---------------------------------------------------------- */

export async function getPeople(): Promise<PeopleView> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason, people: [], teams: [] };

  const [{ data: list }, { data: profs }, { data: teamRows }] = await Promise.all([
    m.admin.auth.admin.listUsers(),
    m.admin.from("profiles").select("id, role, status, team_id, full_name, email, access"),
    m.admin.from("teams").select("id, name, access").order("created_at"),
  ]);

  const pmap = new Map(
    ((profs ?? []) as { id: string; role?: string; status?: string; team_id?: string; full_name?: string; email?: string; access?: unknown }[]).map((p) => [p.id, p]),
  );

  const people: Person[] = (list?.users ?? []).map((u) => {
    const p = pmap.get(u.id);
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
    return {
      id: u.id,
      email: p?.email || u.email || "",
      fullName: p?.full_name || meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "—"),
      role: normalizeRole(p?.role),
      status: p?.status || "active",
      teamId: p?.team_id ?? null,
      access: cleanAccessMap(p?.access),
      lastSignIn: u.last_sign_in_at ?? null,
      isSelf: u.id === m.me.userId,
    };
  });

  const teams = ((teamRows ?? []) as { id: string; name: string; access?: unknown }[]).map((t) => ({
    id: t.id,
    name: t.name,
    access: cleanAccessMap(t.access),
  }));
  return { ok: true, people, teams };
}

export async function setUserRole(userId: string, role: Role): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  // Only a founder may grant or change the founder tier (protects the top level).
  const { data: cur } = await m.admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const curRole = normalizeRole((cur as { role?: string } | null)?.role);
  if ((role === "founder" || curRole === "founder") && m.me.role !== "founder") {
    return { ok: false, reason: "founder_only" };
  }
  await m.admin.from("profiles").upsert({ id: userId, role, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, `Set role → ${role}`, userId);
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function setUserTeam(userId: string, teamId: string | null): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  await m.admin.from("profiles").upsert({ id: userId, team_id: teamId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, teamId ? "Assigned to team" : "Removed from team", userId);
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function setUserStatus(userId: string, status: "active" | "deactivated"): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  if (userId === m.me.userId) return { ok: false, reason: "self" }; // never lock yourself out
  const { data: cur } = await m.admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (normalizeRole((cur as { role?: string } | null)?.role) === "founder" && m.me.role !== "founder") {
    return { ok: false, reason: "founder_only" };
  }
  await m.admin.from("profiles").upsert({ id: userId, status, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, status === "deactivated" ? "Deactivated user" : "Reactivated user", userId);
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

/* ---- Teams ----------------------------------------------------------- */

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("id, name, access").order("created_at");
  return ((data ?? []) as { id: string; name: string; access?: unknown }[]).map((t) => ({
    id: t.id,
    name: t.name,
    access: cleanAccessMap(t.access),
  }));
}

/* Per-team access template — the default Hidden/View/Edit for its members. */
export async function setTeamAccess(teamId: string, access: AccessMap): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const safe = cleanAccessMap(access);
  await m.admin.from("teams").update({ access: safe }).eq("id", teamId);
  await audit(m, "Set team access template", summarizeAccess(safe));
  revalidatePath("/dashboard/admin/teams");
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function createTeam(name: string): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "empty" };
  await m.admin.from("teams").insert({ name: clean });
  await audit(m, "Created team", clean);
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

export async function renameTeam(id: string, name: string): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "empty" };
  await m.admin.from("teams").update({ name: clean }).eq("id", id);
  await audit(m, "Renamed team", clean);
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

export async function deleteTeam(id: string): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  // Unassign anyone on this team first, then remove it.
  await m.admin.from("profiles").update({ team_id: null }).eq("team_id", id);
  await m.admin.from("teams").delete().eq("id", id);
  await audit(m, "Deleted team", id);
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

/* ---- Per-person access ----------------------------------------------- */

/* A person's own per-module overrides (win over their team template). Pass an
   empty map for a module to clear its override and fall back to the team. */
export async function setUserAccess(userId: string, access: AccessMap): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const safe = cleanAccessMap(access);
  await m.admin.from("profiles").upsert({ id: userId, access: safe, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, "Set access", `${userId} → ${summarizeAccess(safe)}`);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/access");
  return { ok: true };
}

/* ---- Org settings ---------------------------------------------------- */

const DEFAULT_ORG: OrgSettings = { brandName: "SwissWiper", timezone: "Europe/Zurich", workingHours: "09:00–18:00" };

export async function getOrgSettings(): Promise<OrgSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("admin_config").select("data").eq("id", "org").maybeSingle();
  const d = (data as { data?: Partial<OrgSettings> } | null)?.data ?? {};
  return { ...DEFAULT_ORG, ...d };
}

export async function saveOrgSettings(s: OrgSettings): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const safe: OrgSettings = {
    brandName: s.brandName.trim() || DEFAULT_ORG.brandName,
    timezone: s.timezone.trim() || DEFAULT_ORG.timezone,
    workingHours: s.workingHours.trim() || DEFAULT_ORG.workingHours,
  };
  await m.admin
    .from("admin_config")
    .upsert({ id: "org", data: safe, updated_at: new Date().toISOString(), updated_by: m.me.userId }, { onConflict: "id" });
  await audit(m, "Updated org settings");
  revalidatePath("/dashboard/admin/settings");
  return { ok: true };
}

/* ---- Audit log ------------------------------------------------------- */

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_name, action, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { id: string; actor_name: string; action: string; detail: string | null; created_at: string }[]).map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
