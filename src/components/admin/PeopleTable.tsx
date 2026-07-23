"use client";

import { useState } from "react";
import { setUserRole, setUserTeam, setUserStatus, setUserAccess } from "@/lib/admin/actions";
import { ROLES, type Role, type AccessMap } from "@/lib/auth/roles";
import type { Person, Team } from "@/lib/admin/types";
import AccessEditor from "./AccessEditor";

/* People — assign role (Founder super-admin / Member), team and status, and
   expand a Member to set their per-module access (which overrides the team). */

export default function PeopleTable({ people: initial, teams, myRole }: { people: Person[]; teams: Team[]; myRole: Role }) {
  const [people, setPeople] = useState<Person[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const patch = (id: string, p: Partial<Person>) => setPeople((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? null : m)), 2600); };
  const teamOf = (id: string | null): Team | undefined => teams.find((t) => t.id === id);

  async function changeRole(p: Person, role: Role) {
    const prev = p.role;
    patch(p.id, { role });
    const r = await setUserRole(p.id, role);
    if (!r.ok) { patch(p.id, { role: prev }); flash(r.reason === "founder_only" ? "Only a founder can change the founder tier." : "Couldn't update role."); }
  }
  async function changeTeam(p: Person, teamId: string | null) {
    patch(p.id, { teamId });
    const r = await setUserTeam(p.id, teamId);
    if (!r.ok) flash("Couldn't update team.");
  }
  async function toggleStatus(p: Person) {
    const next = p.status === "deactivated" ? "active" : "deactivated";
    const prev = p.status;
    patch(p.id, { status: next });
    const r = await setUserStatus(p.id, next);
    if (!r.ok) { patch(p.id, { status: prev }); flash(r.reason === "self" ? "You can't deactivate yourself." : "Couldn't update."); }
  }
  async function changeAccess(p: Person, access: AccessMap) {
    patch(p.id, { access });
    const r = await setUserAccess(p.id, access);
    if (!r.ok) flash("Couldn't save access.");
  }

  return (
    <div className="sw-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div>
          <h3 className="text-[14px] font-medium">People</h3>
          <p className="text-[11px] text-hint">{people.length} {people.length === 1 ? "person" : "people"} · role, team, access & status</p>
        </div>
        {msg && <span className="text-[11px] font-medium text-[#b3261e]">{msg}</span>}
      </div>

      <div className="divide-y divide-hairline">
        {people.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No one has signed in yet.</p>}
        {people.map((p) => {
          const isFounder = p.role === "founder";
          const open = openId === p.id;
          return (
            <div key={p.id} className="flex flex-col">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : p.id)}
                  disabled={isFounder}
                  title={isFounder ? "Founders have full access" : "Set access"}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-hint hover:text-ink disabled:opacity-25"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-90" : ""}><path d="M9 18l6-6-6-6" /></svg>
                </button>

                <div className="min-w-[11rem] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{p.fullName}</span>
                    {p.isSelf && <span className="rounded-full bg-peri-soft px-1.5 py-0.5 text-[9.5px] font-medium text-peri-deep">you</span>}
                    {p.status === "deactivated" && <span className="rounded-full bg-red-500/12 px-1.5 py-0.5 text-[9.5px] font-medium text-red-600">deactivated</span>}
                  </div>
                  <span className="text-[11px] text-hint">{p.email}</span>
                </div>

                <select value={p.role} onChange={(e) => changeRole(p, e.target.value as Role)}
                  className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none">
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key} disabled={(r.key === "founder" || p.role === "founder") && myRole !== "founder"}>{r.label}</option>
                  ))}
                </select>

                <select value={p.teamId ?? ""} onChange={(e) => changeTeam(p, e.target.value || null)}
                  className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none">
                  <option value="">No team</option>
                  {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>

                <button type="button" onClick={() => toggleStatus(p)} disabled={p.isSelf}
                  className={["shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                    p.status === "deactivated" ? "bg-emerald-500/15 text-emerald-700 hover:brightness-95" : "border border-hairline text-muted hover:text-red-600"].join(" ")}>
                  {p.status === "deactivated" ? "Reactivate" : "Deactivate"}
                </button>
              </div>

              {open && !isFounder && (
                <div className="border-t border-hairline bg-bg/40 px-5 py-4 pl-12">
                  <p className="mb-2 text-[11px] text-hint">
                    Per-module access for <b className="text-muted">{p.fullName}</b>
                    {p.teamId ? <> — defaults come from team <b className="text-muted">{teamOf(p.teamId)?.name}</b>, tweak to override.</> : <> — no team, so unset means Hidden.</>}
                    {" "}Overview, Emails, Calendar & Tasks are always on.
                  </p>
                  <AccessEditor value={p.access} inherited={p.teamId ? teamOf(p.teamId)?.access ?? {} : null} onChange={(a) => changeAccess(p, a)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-hint">
        Founders are super-admins (full access). Members see only what their team template or their own overrides allow. Set team templates on the Teams page.
      </p>
    </div>
  );
}
