"use server";

import { getGoogleAccessToken } from "@/lib/google/tokens";

/* Gmail WRITE actions for Alfred. DRAFT-FIRST: createEmailDraft / createReplyDraft
   only stage a draft in the user's Gmail — nothing is sent. sendEmail is the
   separate, explicit send (the client gates it behind its own confirmation).
   The Google access token is fetched server-side and never reaches the browser. */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

type Result = { ok: true } | { ok: false; error: string };

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function buildRaw(opts: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject || "(no subject)"}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  return b64url(`${headers.join("\r\n")}\r\n\r\n${opts.body ?? ""}`);
}

function extractEmail(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim();
}

/* Look up the original message's threading headers for a reply. */
async function replyContext(
  token: string,
  messageId: string,
): Promise<{ threadId: string; to: string; subject: string; inReplyTo: string; references: string } | null> {
  const res = await fetch(
    `${GMAIL}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    threadId?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  const headers = data.payload?.headers ?? [];
  const get = (n: string) =>
    headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  const msgId = get("Message-ID");
  const refs = get("References");
  let subject = get("Subject");
  if (subject && !/^re:/i.test(subject)) subject = `Re: ${subject}`;
  return {
    threadId: data.threadId ?? "",
    to: extractEmail(get("Reply-To") || get("From")),
    subject: subject || "(no subject)",
    inReplyTo: msgId,
    references: (refs ? `${refs} ` : "") + msgId,
  };
}

/* Stage a brand-new draft in Gmail (never sent). */
export async function createEmailDraft(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  if (!input.to?.trim()) return { ok: false, error: "a recipient is needed." };

  const raw = buildRaw({ to: input.to.trim(), subject: input.subject ?? "", body: input.body ?? "" });
  const res = await fetch(`${GMAIL}/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Gmail draft failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}

/* Stage a reply draft threaded to the original message (never sent). The user's
   edits to To/Subject win; blank ones fall back to the original's values. */
export async function createReplyDraft(input: {
  messageId: string;
  to?: string;
  subject?: string;
  body: string;
}): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  const ctx = await replyContext(token, input.messageId);
  if (!ctx) return { ok: false, error: "I couldn't read the original email." };

  const raw = buildRaw({
    to: input.to?.trim() || ctx.to,
    subject: input.subject?.trim() || ctx.subject,
    body: input.body ?? "",
    inReplyTo: ctx.inReplyTo,
    references: ctx.references,
  });
  const res = await fetch(`${GMAIL}/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw, threadId: ctx.threadId || undefined } }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Gmail reply draft failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}

/* Explicit send — only used when the user clearly says "send it" and confirms.
   With messageId it sends as a threaded reply; otherwise a new message. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  messageId?: string;
}): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  let to = input.to?.trim() ?? "";
  let subject = input.subject ?? "";
  let threadId: string | undefined;
  let inReplyTo: string | undefined;
  let references: string | undefined;

  if (input.messageId) {
    const ctx = await replyContext(token, input.messageId);
    if (ctx) {
      to = to || ctx.to;
      subject = subject || ctx.subject;
      threadId = ctx.threadId || undefined;
      inReplyTo = ctx.inReplyTo;
      references = ctx.references;
    }
  }
  if (!to.trim()) return { ok: false, error: "a recipient is needed." };

  const raw = buildRaw({ to, subject, body: input.body ?? "", inReplyTo, references });
  const res = await fetch(`${GMAIL}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Gmail send failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}
