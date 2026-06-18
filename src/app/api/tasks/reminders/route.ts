import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/notifications";

/* Daily reminders cron (hit by Vercel Cron each morning).

   Finds tasks that are overdue, due today, or due tomorrow (and not done),
   groups them per assignee, creates 'due'/'overdue' in-app notifications, and
   sends each person ONE digest email. Protected by CRON_SECRET so only the
   cron can run it. Uses the service-role client because there's no signed-in
   session and it must read across all team members.

   "Today" is computed in UTC (the cron's clock); good enough for a morning
   nudge. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 500 });
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86_400_000);

  // All not-done tasks with a due date before the end of TOMORROW
  // (covers overdue, due today, and due tomorrow).
  const { data: taskRows, error } = await admin
    .from("tasks")
    .select("id, title, due_at, created_by, status")
    .neq("status", "done")
    .is("deleted_at", null)
    .not("due_at", "is", null)
    .lt("due_at", tomorrowEnd.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tasks = taskRows ?? [];
  if (tasks.length === 0) return NextResponse.json({ ok: true, tasks: 0, recipients: 0 });

  // Assignees for those tasks.
  const ids = tasks.map((t) => t.id);
  const { data: assignRows } = await admin
    .from("task_assignees")
    .select("task_id, user_id")
    .in("task_id", ids);

  const assigneesByTask = new Map<string, string[]>();
  for (const r of (assignRows ?? []) as { task_id: string; user_id: string }[]) {
    const list = assigneesByTask.get(r.task_id) ?? [];
    list.push(r.user_id);
    assigneesByTask.set(r.task_id, list);
  }

  // Build recipient -> [{task, bucket}]. Unassigned tasks fall back to creator.
  type Bucket = "overdue" | "today" | "tomorrow";
  type Item = { id: string; title: string; due_at: string; bucket: Bucket };
  const byRecipient = new Map<string, Item[]>();
  for (const t of tasks) {
    const due = Date.parse(t.due_at as string);
    const bucket: Bucket =
      due < todayStart.getTime()
        ? "overdue"
        : due < todayEnd.getTime()
          ? "today"
          : "tomorrow";
    const item: Item = { id: t.id, title: t.title, due_at: t.due_at as string, bucket };
    const recipients = assigneesByTask.get(t.id) ?? (t.created_by ? [t.created_by] : []);
    for (const uid of recipients) {
      const list = byRecipient.get(uid) ?? [];
      list.push(item);
      byRecipient.set(uid, list);
    }
  }

  // Profiles for emails.
  const recipientIds = [...byRecipient.keys()];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", recipientIds);
  const emailById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p as { email?: string }).email]),
  );

  const notificationRows: {
    user_id: string;
    task_id: string;
    type: "due" | "overdue";
    message: string;
  }[] = [];

  let emailsSent = 0;
  for (const [uid, items] of byRecipient) {
    // In-app notifications, one per task. 'overdue' uses its own type;
    // due-today and due-tomorrow both reuse the 'due' type with a clear message.
    for (const it of items) {
      notificationRows.push({
        user_id: uid,
        task_id: it.id,
        type: it.bucket === "overdue" ? "overdue" : "due",
        message:
          it.bucket === "overdue"
            ? `Overdue: "${it.title}" (was due ${fmt(it.due_at)}).`
            : it.bucket === "today"
              ? `Due today: "${it.title}".`
              : `Due tomorrow: "${it.title}".`,
      });
    }

    // One digest email: overdue, then due today, then due tomorrow.
    const to = emailById.get(uid);
    if (to) {
      const overdue = items.filter((i) => i.bucket === "overdue");
      const dueToday = items.filter((i) => i.bucket === "today");
      const dueTomorrow = items.filter((i) => i.bucket === "tomorrow");
      const lines = [
        ...overdue.map((i) => `Overdue — ${i.title} (was due ${fmt(i.due_at)})`),
        ...dueToday.map((i) => `Due today — ${i.title}`),
        ...dueTomorrow.map((i) => `Due tomorrow — ${i.title}`),
      ];
      await sendEmail(
        to,
        `Your tasks (${items.length})`,
        emailTemplate({
          heading: "Your tasks",
          body: `You have ${items.length} task${items.length === 1 ? "" : "s"} that need attention.`,
          lines,
          linkLabel: "Open Tasks",
        }),
      );
      emailsSent++;
    }
  }

  if (notificationRows.length) {
    await admin.from("notifications").insert(notificationRows);
  }

  return NextResponse.json({
    ok: true,
    tasks: tasks.length,
    recipients: byRecipient.size,
    notifications: notificationRows.length,
    emailsSent,
  });
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
