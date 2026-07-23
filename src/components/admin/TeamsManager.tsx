"use client";

import { useState } from "react";
import { getTeams, createTeam, renameTeam, deleteTeam } from "@/lib/admin/actions";
import type { Team } from "@/lib/admin/types";

/* Create, rename and remove teams. Teams are used on the People page to group
   teammates (and, later, to scope access by team). */

export default function TeamsManager({ initial }: { initial: Team[] }) {
  const [teams, setTeams] = useState<Team[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = async () => setTeams(await getTeams());
  const setLocalName = (id: string, n: string) => setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, name: n } : t)));

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

  return (
    <div className="sw-card overflow-hidden">
      <div className="border-b border-hairline px-5 py-3">
        <h3 className="text-[14px] font-medium">Teams</h3>
        <p className="text-[11px] text-hint">Group teammates. Assign people to a team on the People page.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New team name…"
          className="min-w-[12rem] flex-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !name.trim()}
          className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
        >
          Add team
        </button>
      </div>

      <div className="mt-3 divide-y divide-hairline">
        {teams.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No teams yet — add your first above.</p>
        ) : (
          teams.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
              <input
                value={t.name}
                onChange={(e) => setLocalName(t.id, e.target.value)}
                onBlur={(e) => rename(t.id, e.target.value)}
                className="min-w-[10rem] flex-1 bg-transparent text-sm text-ink focus:outline-none"
              />
              {confirmId === t.id ? (
                <>
                  <span className="text-xs text-muted">Delete this team?</span>
                  <button type="button" onClick={() => remove(t.id)} className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-ink">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(t.id)}
                  className="shrink-0 text-xs text-hint transition-colors hover:text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-hint">
        Removing a team just unassigns its members — nobody is deleted.
      </p>
    </div>
  );
}
