import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import EmailsBoard from "@/components/email/EmailsBoard";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const m = getModule("emails")!;
  const token = await getGoogleAccessToken();

  let view: InboxView | null = null;
  let errored = false;

  if (token) {
    try {
      view = await getInboxView(token);
    } catch (e) {
      errored = true;
      // eslint-disable-next-line no-console
      console.error("Gmail fetch failed:", e);
    }
  }

  const connected = !!view && !errored;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Your triaged inbox, read-only — nothing is ever deleted or changed."
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Gmail" />
          </div>
        }
      />

      {connected ? (
        <EmailsBoard view={view!} />
      ) : (
        <div className="sw-card px-6">
          <ConnectState
            icon={m.icon}
            message={
              token
                ? "Reconnect your Google account to grant read-only Gmail access, then your triaged inbox will appear here."
                : "Connect your Google account with read-only Gmail access to see your triaged inbox."
            }
            action={<GoogleAuthButton variant="inline" label="Connect Gmail access" />}
          />
        </div>
      )}
    </div>
  );
}
