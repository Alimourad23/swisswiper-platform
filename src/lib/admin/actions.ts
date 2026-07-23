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

type AuditOpts = { module?: string; target?: string | null; before?: string | null; after?: string | null };

async function audit(m: { admin: NonNullable<ReturnType<typeof createAdminClient>>; me: Me }, action: string, opts: AuditOpts = {}) {
  try {
    await m.admin.from("audit_log").insert({
      actor_id: m.me.userId,
      actor_name: m.me.name,
      action,
      module: opts.module ?? "admin",
      target: opts.target ?? null,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch {
    /* audit is best-effort */
  }
}

/* Readable label for a target user (name → email → id). */
async function nameOf(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  const p = data as { full_name?: string; email?: string } | null;
  return p?.full_name || p?.email || userId;
}
const teamNameOf = (teams: { id: string; name: string }[], id: string | null) => (id ? teams.find((t) => t.id === id)?.name ?? "a team" : "no team");

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

/* Invite a teammate by email. Sends a Supabase invite (they set their own
   password via the emailed link) and pre-assigns their role + team so they land
   with the right access on first sign-in. Only a founder can invite straight in
   as a founder. */
export async function inviteUser(
  email: string,
  role: Role,
  teamId: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, reason: "bad_email" };
  if (role === "founder" && m.me.role !== "founder") return { ok: false, reason: "founder_only" };

  const { data, error } = await m.admin.auth.admin.inviteUserByEmail(clean);
  if (error || !data?.user) {
    // Most common cause: the address already has an account.
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) return { ok: false, reason: "exists" };
    return { ok: false, reason: "invite_failed" };
  }

  await m.admin.from("profiles").upsert(
    { id: data.user.id, email: clean, role, team_id: teamId, status: "active", updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  await audit(m, "Invited teammate", { target: clean, after: role });
  revalidatePath("/dashboard/admin");
  return { ok: true };
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
  await audit(m, "Changed role", { target: await nameOf(m.admin, userId), before: curRole, after: role });
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

export async function setUserTeam(userId: string, teamId: string | null): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const [{ data: prev }, { data: teamRows }] = await Promise.all([
    m.admin.from("profiles").select("team_id").eq("id", userId).maybeSingle(),
    m.admin.from("teams").select("id, name"),
  ]);
  const teams = (teamRows ?? []) as { id: string; name: string }[];
  await m.admin.from("profiles").upsert({ id: userId, team_id: teamId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, "Changed team", {
    target: await nameOf(m.admin, userId),
    before: teamNameOf(teams, (prev as { team_id?: string } | null)?.team_id ?? null),
    after: teamNameOf(teams, teamId),
  });
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
  await audit(m, status === "deactivated" ? "Deactivated" : "Reactivated", {
    target: await nameOf(m.admin, userId),
    before: status === "deactivated" ? "active" : "deactivated",
    after: status,
  });
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
  const { data: prevT } = await m.admin.from("teams").select("access, name").eq("id", teamId).maybeSingle();
  const prev = prevT as { access?: unknown; name?: string } | null;
  await m.admin.from("teams").update({ access: safe }).eq("id", teamId);
  await audit(m, "Changed team access", { target: prev?.name ?? "team", before: summarizeAccess(cleanAccessMap(prev?.access)), after: summarizeAccess(safe) });
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
  await audit(m, "Created team", { target: clean });
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

export async function renameTeam(id: string, name: string): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "empty" };
  await m.admin.from("teams").update({ name: clean }).eq("id", id);
  await audit(m, "Renamed team", { target: clean });
  revalidatePath("/dashboard/admin/teams");
  return { ok: true };
}

export async function deleteTeam(id: string): Promise<{ ok: boolean; reason?: string }> {
  const m = await manager();
  if (!m.ok) return { ok: false, reason: m.reason };
  // Unassign anyone on this team first, then remove it.
  await m.admin.from("profiles").update({ team_id: null }).eq("team_id", id);
  await m.admin.from("teams").delete().eq("id", id);
  await audit(m, "Deleted team", { target: id });
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
  const { data: prevRow } = await m.admin.from("profiles").select("access").eq("id", userId).maybeSingle();
  const before = summarizeAccess(cleanAccessMap((prevRow as { access?: unknown } | null)?.access));
  await m.admin.from("profiles").upsert({ id: userId, access: safe, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await audit(m, "Changed access", { target: await nameOf(m.admin, userId), before, after: summarizeAccess(safe) });
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
  await audit(m, "Updated org settings", { after: `${safe.brandName} · ${safe.timezone} · ${safe.workingHours}` });
  revalidatePath("/dashboard/admin/settings");
  return { ok: true };
}

/* ---- Audit log ------------------------------------------------------- */

export async function getAuditLog(limit = 150): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_name, action, module, target, before, after, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as {
    id: string; actor_name: string; action: string;
    module: string | null; target: string | null; before: string | null; after: string | null; created_at: string;
  }[]).map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    action: r.action,
    module: r.module,
    target: r.target,
    before: r.before,
    after: r.after,
    createdAt: r.created_at,
  }));
}
