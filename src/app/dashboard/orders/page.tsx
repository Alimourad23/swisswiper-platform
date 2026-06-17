import ModuleHeader from "@/components/ModuleHeader";
import SoonState from "@/components/SoonState";
import { SoonPill } from "@/components/Pill";
import { getModule } from "@/lib/modules";

export default function OrdersPage() {
  const m = getModule("orders")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader icon={m.icon} title={m.name} subtitle={m.subtitle} right={<SoonPill />} />
      <SoonState note="Order-to-delivery status will appear here. The data model is being prepared now and connects at launch." />
    </div>
  );
}
