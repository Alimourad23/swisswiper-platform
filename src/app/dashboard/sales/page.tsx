import ModuleHeader from "@/components/ModuleHeader";
import SoonState from "@/components/SoonState";
import { SoonPill } from "@/components/Pill";
import { getModule } from "@/lib/modules";

export default function SalesPage() {
  const m = getModule("sales")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader icon={m.icon} title={m.name} subtitle={m.subtitle} right={<SoonPill />} />
      <SoonState note="Pipeline and conversion, powered by Apollo, will appear here when the sales module goes live." />
    </div>
  );
}
