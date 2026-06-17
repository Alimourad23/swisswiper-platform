import ModuleHeader from "@/components/ModuleHeader";
import ConnectState from "@/components/ConnectState";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { LivePill, ServiceBadge, PriorityPill, SafePill } from "@/components/Pill";
import { getModule } from "@/lib/modules";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView, type TriagedThread } from "@/lib/google/gmail";

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
        <>
          {/* Headline counts */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Unread" value={view!.unread} />
            <Stat label="Received this week" value={view!.week} />
            <Stat label="Need attention" value={view!.needAttention} accent />
          </section>

          {/* Triaged list — same set the counts are derived from */}
          <div className="sw-card">
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <h3 className="text-base font-medium">Triaged inbox</h3>
              <span className="text-xs text-hint">Most recent {view!.threads.length}</span>
            </div>
            {view!.threads.length > 0 ? (
              <ul>
                {view!.threads.map((t) => (
                  <EmailRow key={t.id} thread={t} />
                ))}
              </ul>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-muted">Your inbox is empty.</p>
            )}
            <p className="border-t border-hairline px-6 py-3 text-xs text-hint">
              “Safe to delete” is only a suggestion based on Gmail’s own categories and sender
              signals. Nothing is ever deleted or modified.
            </p>
          </div>
        </>
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

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="sw-card px-6 py-5">
      <span className="text-sm text-muted">{label}</span>
      <p
        className={[
          "mt-2 text-3xl font-medium tracking-tight",
          accent ? "text-peri-deep" : "text-ink",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function EmailRow({ thread }: { thread: TriagedThread }) {
  return (
    <li className="flex items-center justify-between gap-4 border-t border-hairline px-6 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {thread.unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-peri-deep" aria-label="unread" />
          )}
          <span className="truncate text-sm font-medium text-ink">{thread.senderName}</span>
        </div>
        <p className="truncate text-sm text-muted">{thread.subject}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {thread.tag === "priority" && <PriorityPill />}
        {thread.tag === "safe" && <SafePill />}
        <span className="w-14 text-right text-xs text-hint">{formatDate(thread.date)}</span>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}
