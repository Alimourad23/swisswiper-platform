import ModuleHeader from "@/components/ModuleHeader";
import SoonState from "@/components/SoonState";
import { SoonPill } from "@/components/Pill";
import { getModule } from "@/lib/modules";

export default function MarketingPage() {
  const m = getModule("marketing")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader icon={m.icon} title={m.name} subtitle={m.subtitle} right={<SoonPill />} />
      <SoonState note="Marketing performance across LinkedIn, Instagram and TikTok will appear here. Manual-entry cards come first, live data later." />
    </div>
  );
}
