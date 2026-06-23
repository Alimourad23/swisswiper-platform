import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import EmailsBoard from "@/components/email/EmailsBoard";
import { LivePill, ServiceBadge } from "@/components/Pill";
import { getModule } from "@/lib/modules";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";

/* Page shell renders instantly; the slow Gmail fetch streams in via Suspense. */
export default function EmailsPage() {
  const m = getModule("emails")!;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={m.icon}
        title={m.name}
        subtitle="Your triaged inbox. Reading is read-only; you can move junk to Trash (recoverable)."
        right={
          <div className="flex items-center gap-2">
            <LivePill />
            <ServiceBadge label="Gmail" />
          </div>
        }
      />
      <Suspense fallback={<BoardSkeleton />}>
        <EmailsData />
      </Suspense>
    </div>
  );
}

async function EmailsData() {
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

  if (view && !errored) return <EmailsBoard view={view} />;

  // A fetch failure is NOT the same as being signed out — say so plainly.
  if (errored) {
    return (
      <div className="sw-card px-6">
        <ConnectState
          icon={m.icon}
          message="I couldn't reach Gmail just now. This is usually temporary — refresh in a moment. If it keeps happening, reconnect your Google account from the menu."
          action={<GoogleAuthButton variant="inline" label="Reconnect Google" forceConsent />}
        />
      </div>
    );
  }

  return (
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
  );
}

function BoardSkeleton() {
  return (
    <div className="sw-card flex flex-col gap-3 px-6 py-6">
      <div className="h-5 w-40 animate-pulse rounded bg-bg" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-[var(--radius-control)] bg-bg" />
      ))}
    </div>
  );
}
