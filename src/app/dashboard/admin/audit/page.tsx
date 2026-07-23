import ModuleHeader from "@/components/ModuleHeader";
import AdminNav from "@/components/admin/AdminNav";
import { NotAuthorised, adminIcon } from "@/components/admin/AdminNotices";
import { getAuditLog, getMyRole } from "@/lib/admin/actions";
import { isManager } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default async function AdminAuditPage() {
  const role = await getMyRole();
  if (!isManager(role)) return <NotAuthorised />;

  const entries = await getAuditLog(150);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader icon={adminIcon} title="Admin" subtitle="Audit log — who did what" />
      <AdminNav active="audit" />

      <div className="sw-card overflow-hidden">
        <div className="border-b border-hairline px-5 py-3">
          <h3 className="text-[14px] font-medium">Recent activity</h3>
          <p className="text-[11px] text-hint">Admin actions across the platform, newest first.</p>
        </div>
        {entries.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12.5px] font-medium text-ink">{e.actorName}</span>
                  <span className="text-[12.5px] text-muted">{e.action.toLowerCase()}</span>
                  {e.target && <span className="text-[12.5px] font-medium text-ink">{e.target}</span>}
                  {e.module && (
                    <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-hint">
                      {e.module}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-hint">{when(e.createdAt)}</span>
                </div>
                {(e.before || e.after) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {e.before && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-600 line-through decoration-rose-300">
                        {e.before}
                      </span>
                    )}
                    {e.before && e.after && <span className="text-hint">→</span>}
                    {e.after && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{e.after}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
