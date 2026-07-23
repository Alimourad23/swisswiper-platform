import { GATED_MODULES, effectiveLevels, type Level } from "@/lib/auth/roles";
import type { Person, Team } from "@/lib/admin/types";

/* Read-only overview: everyone's effective access across the gated modules.
   Editing happens on People (per person) and Teams (templates); this is the
   at-a-glance "who can see what" picture. */

const cellClass: Record<Level, string> = {
  hidden: "text-hint",
  view: "text-amber-700",
  edit: "text-peri-deep font-medium",
};
const cellLabel: Record<Level, string> = { hidden: "—", view: "View", edit: "Edit" };

export default function AccessMatrix({ people, teams }: { people: Person[]; teams: Team[] }) {
  const teamAccess = (id: string | null) => (id ? teams.find((t) => t.id === id)?.access ?? null : null);

  return (
    <div className="sw-card overflow-hidden">
      <div className="border-b border-hairline px-5 py-3">
        <h3 className="text-[14px] font-medium">Access overview</h3>
        <p className="text-[11px] text-hint">Everyone&apos;s effective access. Founders are full; Members follow their team + overrides.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline text-hint">
              <th className="px-5 py-2 text-left font-medium">Person</th>
              {GATED_MODULES.map((m) => (
                <th key={m.key} className="px-3 py-2 text-center font-medium">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr><td colSpan={GATED_MODULES.length + 1} className="px-5 py-6 text-center text-muted">No one has signed in yet.</td></tr>
            )}
            {people.map((p) => {
              const levels = effectiveLevels(p.role, p.access, teamAccess(p.teamId));
              return (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <td className="px-5 py-2.5 text-left">
                    <span className="font-medium text-ink">{p.fullName}</span>
                    {p.role === "founder" && <span className="ml-2 rounded-full bg-peri-soft px-1.5 py-0.5 text-[9.5px] font-medium text-peri-deep">founder</span>}
                    {p.status === "deactivated" && <span className="ml-2 text-[10px] text-red-600">deactivated</span>}
                  </td>
                  {GATED_MODULES.map((m) => {
                    const lvl = levels[m.key] as Level;
                    return <td key={m.key} className={`px-3 py-2.5 text-center ${cellClass[lvl]}`}>{cellLabel[lvl]}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-hint">
        Overview, Emails, Calendar & Tasks are always on for everyone and aren&apos;t shown here. Edit access on the People and Teams pages.
      </p>
    </div>
  );
}
