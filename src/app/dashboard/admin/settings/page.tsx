import ModuleHeader from "@/components/ModuleHeader";
import AdminNav from "@/components/admin/AdminNav";
import OrgSettingsForm from "@/components/admin/OrgSettingsForm";
import { NotAuthorised, adminIcon } from "@/components/admin/AdminNotices";
import { getOrgSettings, getMyRole } from "@/lib/admin/actions";
import { isManager } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const role = await getMyRole();
  if (!isManager(role)) return <NotAuthorised />;

  const settings = await getOrgSettings();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ModuleHeader icon={adminIcon} title="Admin" subtitle="Personalisation & settings" />
      <AdminNav active="settings" />
      <OrgSettingsForm initial={settings} />
    </div>
  );
}
