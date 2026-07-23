import ModuleHeader from "@/components/ModuleHeader";
import AdminNav from "@/components/admin/AdminNav";
import AccessMatrix from "@/components/admin/AccessMatrix";
import { NotAuthorised, adminIcon } from "@/components/admin/AdminNotices";
import { getAccessPolicy, getMyRole } from "@/lib/admin/actions";
import { isManager } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const role = await getMyRole();
  if (!isManager(role)) return <NotAuthorised />;

  const policy = await getAccessPolicy();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader icon={adminIcon} title="Admin" subtitle="Access control — who sees what" />
      <AdminNav active="access" />
      <AccessMatrix policy={policy} />
    </div>
  );
}
