import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileNav from "@/components/MobileNav";
import AlfredSummon from "@/components/bridge/AlfredSummon";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-sw-white">
      <Sidebar />
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
