import ModuleHeader from "@/components/ModuleHeader";
import AdminNav from "@/components/admin/AdminNav";
import PeopleTable from "@/components/admin/PeopleTable";
import { NotAuthorised, SetupNote, adminIcon } from "@/components/admin/AdminNotices";
import { getPeople, getMyRole } from "@/lib/admin/actions";
import { isManager } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AdminPeoplePage() {
  const role = await getMyRole();
  if (!isManager(role)) return <NotAuthorised />;

  const view = await getPeople();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader icon={adminIcon} title="Admin" subtitle="People, roles and access" />
      <AdminNav active="people" />
      {view.ok ? <PeopleTable people={view.people} teams={view.teams} myRole={role} /> : <SetupNote reason={view.reason} />}
    </div>
  );
}
