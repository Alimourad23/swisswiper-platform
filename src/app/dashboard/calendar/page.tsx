import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";

export default function CalendarPage() {
  const m = getModule("calendar")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle={m.subtitle}
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Google Calendar" />
          </div>
        }
      />
      <div className="sw-card px-6">
        <ConnectState
          icon={m.icon}
          message="Connect Google Calendar to see today's agenda and your meeting load at a glance."
          ctaLabel="Connect Calendar"
        />
      </div>
    </div>
  );
}
