import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";

export default function EmailsPage() {
  const m = getModule("emails")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle={m.subtitle}
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Gmail" />
          </div>
        }
      />
      <div className="sw-card px-6">
        <ConnectState
          icon={m.icon}
          message="Connect Gmail to see your triaged inbox — what needs a reply, what can wait, and what to ignore."
          ctaLabel="Connect Gmail"
        />
      </div>
    </div>
  );
}
