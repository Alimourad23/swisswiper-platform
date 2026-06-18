import Bridge from "@/components/bridge/Bridge";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { getInboxView, type InboxView } from "@/lib/google/gmail";
import { getCalendarData } from "@/lib/google/calendar";
import { getLinkedInMetrics } from "@/lib/linkedin/data";
import { windowAgg } from "@/lib/linkedin/compute";
import { getTasksData } from "@/lib/tasks/data";
import type { BridgeData } from "@/lib/bridge/briefing";

export const dynamic = "force-dynamic";

/* The Bridge — the post-login landing. Composes Alfred's briefing from the
   same read-only data functions the modules use, then hands the raw facts to
   the client (which formats them in the viewer's timezone and speaks them). */
export default async function BridgePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const fullName = meta.full_name ?? meta.name ?? user?.email ?? "";
  const firstName = fullName.split(" ")[0] || "there";

  // Live Gmail + Calendar (null until Google is connected).
  const token = await getGoogleAccessToken();
  let gmail: InboxView | null = null;
  let calendar: Awaited<ReturnType<typeof getCalendarData>> | null = null;
  if (token) {
    try {
      gmail = await getInboxView(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Bridge: Gmail view failed:", e);
    }
    try {
      calendar = await getCalendarData(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Bridge: Calendar view failed:", e);
    }
  }

  // Marketing pulse (LinkedIn — latest export, falls back to seed).
  const { metrics: li } = await getLinkedInMetrics();
  const liAgg = windowAgg(li, 365);

  // My open tasks (creator or assignee, not done, not trashed). Due dates are
  // sent raw so the client can bucket overdue/due-today in its own timezone.
  const { tasks, userId } = await getTasksData();
  const mine = tasks.filter(
    (t) =>
      !t.deleted_at &&
      t.status !== "done" &&
      (t.created_by === userId || t.assignees.includes(userId ?? "")),
  );

  const data: BridgeData = {
    firstName,
    gmail: gmail
      ? {
          unread: gmail.unread,
          needAttention: gmail.needAttention,
          awaitingReply: gmail.awaitingReply,
        }
      : null,
    events: calendar ? calendar.events : null,
    myOpenTasks: mine.length,
    myTaskDueDates: mine.map((t) => t.due_at),
    marketing: {
      followers: li.followersAllTime,
      engagementRatePct: liAgg.engagementRate * 100,
    },
  };

  return <Bridge data={data} />;
}
