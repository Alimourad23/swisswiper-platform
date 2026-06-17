import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import CalendarBoard from "@/components/calendar/CalendarBoard";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getCalendarData } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
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

  const connected = !!data && !errored;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Your agenda and meeting load, read-only — nothing is ever changed."
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Google Calendar" />
          </div>
        }
      />

      {connected ? (
        <CalendarBoard events={data!.events} pendingInvites={data!.pendingInvites} />
      ) : (
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
      )}
    </div>
  );
}
