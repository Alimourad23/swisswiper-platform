"use client";

import { useState } from "react";
import { getTeams, createTeam, renameTeam, deleteTeam, setTeamAccess } from "@/lib/admin/actions";
import type { Team } from "@/lib/admin/types";
import type { AccessMap } from "@/lib/auth/roles";
import AccessEditor from "./AccessEditor";

/* Teams — create/rename/remove, and set each team's access template (the default
   Hidden/View/Edit its members get, before any per-person override). */

export default function TeamsManager({ initial }: { initial: Team[] }) {
  const [teams, setTeams] = useState<Team[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = async () => setTeams(await getTeams());
  const patch = (id: string, p: Partial<Team>) => setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  async function add() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    await createTeam(n);
    setName("");
    await refresh();
    setBusy(false);
  }
  async function rename(id: string, n: string) {
    if (!n.trim()) { await refresh(); return; }
    await renameTeam(id, n.trim());
  }
  async function remove(id: string) {
    setConfirmId(null);
    setTeams((ts) => ts.filter((t) => t.id !== id));
    await deleteTeam(id);
    await refresh();
  }
  async function changeAccess(t: Team, access: AccessMap) {
    patch(t.id, { access });
    await setTeamAccess(t.id, access);
  }

  return (
    <div className="sw-card overflow-hidden">
      <div className="border-b border-hairline px-5 py-3">
        <h3 className="text-[14px] font-medium">Teams</h3>
        <p className="text-[11px] text-hint">Group teammates and set each team&apos;s default access. Assign people to a team on the People page.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New team name…"
          className="min-w-[12rem] flex-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none" />
        <button type="button" onClick={add} disabled={busy || !name.trim()}
          className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50">
          Add team
        </button>
      </div>

      <div className="mt-3 divide-y divide-hairline">
        {teams.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No teams yet — add your first above.</p>
        ) : (
          teams.map((t) => {
            const open = openId === t.id;
            return (
              <div key={t.id} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                  <button type="button" onClick={() => setOpenId(open ? null : t.id)} title="Access template"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-hint hover:text-ink">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-90" : ""}><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  <input value={t.name} onChange={(e) => patch(t.id, { name: e.target.value })} onBlur={(e) => rename(t.id, e.target.value)}
                    className="min-w-[9rem] flex-1 bg-transparent text-sm text-ink focus:outline-none" />
                  {confirmId === t.id ? (
                    <>
                      <span className="text-xs text-muted">Delete this team?</span>
                      <button type="button" onClick={() => remove(t.id)} className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700">Delete</button>
                      <button type="button" onClick={() => setConfirmId(null)} className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-ink">Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(t.id)} className="shrink-0 text-xs text-hint transition-colors hover:text-red-600 hover:underline">Remove</button>
                  )}
                </div>

                {open && (
                  <div className="border-t border-hairline bg-bg/40 px-5 py-4 pl-12">
                    <p className="mb-2 text-[11px] text-hint">Default access for everyone on <b className="text-muted">{t.name}</b> (a person&apos;s own overrides win).</p>
                    <AccessEditor value={t.access} onChange={(a) => changeAccess(t, a)} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-hint">Removing a team just unassigns its members — nobody is deleted.</p>
    </div>
  );
}
