import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import CalendarBoard from "@/components/calendar/CalendarBoard";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getCalendarData } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

/* Page shell renders instantly; the slow Calendar fetch streams in via Suspense. */
export default function CalendarPage() {
  const m = getModule("calendar")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Your agenda and meeting load — create, reschedule, or cancel through Alfred."
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Google Calendar" />
          </div>
        }
      />
      <Suspense fallback={<BoardSkeleton />}>
        <CalendarData />
      </Suspense>
    </div>
  );
}

async function CalendarData() {
  const m = getModule("calendar")!;
  const token = await getGoogleAccessToken();

  let data: Awaited<ReturnType<typeof getCalendarData>> | null = null;
  let errored = false;
  if (token) {
    try {
      data = await getCalendarData(token);
    } catch (e) {
      errored = true;
      // eslint-disable-next-line no-console
      console.error("Calendar fetch failed:", e);
    }
  }

  if (data && !errored) return <CalendarBoard events={data.events} />;

  return (
    <div className="sw-card px-6">
      <ConnectState
        icon={m.icon}
        message={
          token
            ? "Reconnect your Google account to grant read-only Calendar access, then your agenda will appear here."
            : "Connect your Google account with read-only Calendar access to see your agenda."
        }
        action={<GoogleAuthButton variant="inline" label="Connect Calendar access" />}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="sw-card flex flex-col gap-3 px-6 py-6">
      <div className="h-5 w-40 animate-pulse rounded bg-bg" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-[var(--radius-control)] bg-bg" />
      ))}
    </div>
  );
}
