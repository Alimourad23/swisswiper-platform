import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* ────────────────────────────────────────────────────────────────────────
   Shared notification service (cross-cutting — NOT owned by any one module).

   Any module can call notify() to create an in-app notification and, for the
   most important events, send an instant email. It is deliberately tiny and
   has no UI: it just writes a row and (optionally) sends mail.
   ──────────────────────────────────────────────────────────────────────── */

export type NotificationType =
  | "assigned"
  | "mentioned"
  | "comment"
  | "status"
  | "due"
  | "overdue";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TASKS_LINK = `${APP_URL}/dashboard/tasks`;
const FROM = "SwissWiper <notifications@swisswiper.com>";

type NotifyArgs = {
  userId: string; // recipient
  actorId?: string | null; // who triggered it (to avoid self-notifying)
  type: NotificationType;
  taskId?: string | null;
  message: string;
};

/* Create an in-app notification for `userId`. Skips silently when the
   recipient is the actor (never notify someone about their own action).
   For 'assigned' and 'mentioned' it also sends an instant email. */
export async function notify({ userId, actorId, type, taskId, message }: NotifyArgs) {
  if (!userId || (actorId && userId === actorId)) return;

  const admin = createAdminClient();
  if (!admin) {
    // No service-role key yet — keep the app working, just skip the notification.
    // eslint-disable-next-line no-console
    console.warn(`[notify] SUPABASE_SERVICE_ROLE_KEY missing — skipped '${type}' for ${userId}`);
    return;
  }

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    task_id: taskId ?? null,
    type,
    message,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[notify] insert failed:", error.message);
  }

  if (type === "assigned" || type === "mentioned") {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    const to = (profile as { email?: string } | null)?.email;
    if (to) {
      const subject = type === "assigned" ? "You have a new task" : "You were mentioned";
      await sendEmail(to, subject, emailTemplate({ heading: subject, body: message }));
    }
  }
}

/* Send a single email via Resend's REST API (no SDK dependency).
   If RESEND_API_KEY is missing, logs and no-ops so the app still works. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // eslint-disable-next-line no-console
    console.log(`[email] RESEND_API_KEY missing — would send "${subject}" to ${to}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("[email] send failed:", await res.text());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email] error:", e);
  }
}

/* ── On-brand, plain email template ─────────────────────────────────────── */

export function emailTemplate({
  heading,
  body,
  lines,
  link = TASKS_LINK,
  linkLabel = "Open Tasks",
}: {
  heading: string;
  body?: string;
  lines?: string[];
  link?: string;
  linkLabel?: string;
}) {
  const items = lines?.length
    ? `<ul style="margin:0 0 20px;padding-left:18px;color:#0b0b0f;font-size:15px;line-height:1.7">${lines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul>`
    : "";
  const para = body
    ? `<p style="margin:0 0 24px;color:#0b0b0f;font-size:15px;line-height:1.6">${escapeHtml(body)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f9;font-family:Helvetica,Arial,sans-serif;padding:32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border:1px solid rgba(11,11,15,0.06);border-radius:20px;padding:36px 40px">
          <tr><td>
            <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.04em;color:#9a9ba4;text-transform:uppercase">SwissWiper</p>
            <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#0b0b0f">${escapeHtml(heading)}</h1>
            ${para}
            ${items}
            <a href="${link}" style="display:inline-block;background:#5c66a6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:11px">${escapeHtml(linkLabel)}</a>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9a9ba4">SwissWiper performance platform</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
