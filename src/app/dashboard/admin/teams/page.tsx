import ModuleHeader from "@/components/ModuleHeader";
import AdminNav from "@/components/admin/AdminNav";
import TeamsManager from "@/components/admin/TeamsManager";
import { NotAuthorised, adminIcon } from "@/components/admin/AdminNotices";
import { getTeams, getMyRole } from "@/lib/admin/actions";
import { isManager } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const role = await getMyRole();
  if (!isManager(role)) return <NotAuthorised />;

  const teams = await getTeams();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader icon={adminIcon} title="Admin" subtitle="Teams" />
      <AdminNav active="teams" />
      <TeamsManager initial={teams} />
    </div>
  );
}
