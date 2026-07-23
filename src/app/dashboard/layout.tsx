import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileNav from "@/components/MobileNav";
import AlfredSummon from "@/components/bridge/AlfredSummon";
import { getAccess } from "@/lib/auth/guard";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getAccess();

  // A deactivated teammate can sign in but sees nothing until reactivated.
  if (access.userId && access.status === "deactivated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sw-white px-6">
        <div className="sw-card max-w-md p-8 text-center">
          <h1 className="text-[18px] font-medium">Your access is paused</h1>
          <p className="mt-2 text-sm text-muted">
            Your account has been deactivated. If you think this is a mistake, please ask a founder to reactivate you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-sw-white">
      <Sidebar allowed={access.allowed} manager={access.manager} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <MobileNav />
        <main className="flex-1 px-6 py-10 sm:px-10 lg:px-14">{children}</main>
      </div>
      {/* Alfred, summonable from every dashboard page (button / hotkey / wake word). */}
      <AlfredSummon />
    </div>
  );
}
