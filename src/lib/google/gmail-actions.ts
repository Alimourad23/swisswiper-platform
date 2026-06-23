"use server";

import { getGoogleAccessToken } from "@/lib/google/tokens";

/* Gmail WRITE actions for Alfred. DRAFT-FIRST: createEmailDraft / createReplyDraft
   only stage a draft in the user's Gmail — nothing is sent. sendEmail is the
   separate, explicit send (the client gates it behind its own confirmation).
   The Google access token is fetched server-side and never reaches the browser. */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

type Result = { ok: true } | { ok: false; error: string };
type DraftResult = { ok: true; draftId?: string } | { ok: false; error: string };

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function buildRaw(opts: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers = [`To: ${opts.to}`];
  if (opts.cc?.trim()) headers.push(`Cc: ${opts.cc.trim()}`);
  if (opts.bcc?.trim()) headers.push(`Bcc: ${opts.bcc.trim()}`);
  headers.push(
    `Subject: ${opts.subject || "(no subject)"}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  );
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  return b64url(`${headers.join("\r\n")}\r\n\r\n${opts.body ?? ""}`);
}

function extractEmail(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim();
}

/* Read the plain-text body of a message so Alfred can reply in context.
   READ-ONLY (a GET). Walks the MIME parts, preferring text/plain, falling back
   to stripped text/html. */
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function collectParts(p: Part | undefined, acc: { mime: string; data: string }[]) {
  if (!p) return;
  if (p.body?.data && (p.mimeType === "text/plain" || p.mimeType === "text/html")) {
    acc.push({ mime: p.mimeType, data: p.body.data });
  }
  (p.parts ?? []).forEach((c) => collectParts(c, acc));
}

function decodePart(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

export async function getEmailBody(
  messageId: string,
): Promise<{ ok: true; body: string; from: string; subject: string } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  const res = await fetch(`${GMAIL}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Gmail returned ${res.status}.` };

  const data = (await res.json()) as {
    payload?: Part & { headers?: { name: string; value: string }[] };
  };
  const headers = data.payload?.headers ?? [];
  const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

  const acc: { mime: string; data: string }[] = [];
  collectParts(data.payload, acc);
  const plain = acc.find((a) => a.mime === "text/plain");
  let body = "";
  if (plain) body = decodePart(plain.data);
  else if (acc[0]) body = decodePart(acc[0].data).replace(/<[^>]+>/g, " ");

  body = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  return { ok: true, body, from: get("From"), subject: get("Subject") };
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

/* Move a whole conversation to Gmail Trash — RECOVERABLE (Gmail keeps trashed
   mail ~30 days). Requires the gmail.modify scope; a 403 means it hasn't been
   granted yet (reconnect Google). Nothing is ever permanently deleted here. */
export async function trashThread(threadId: string): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  if (!threadId) return { ok: false, error: "no conversation specified." };

  const res = await fetch(`${GMAIL}/threads/${encodeURIComponent(threadId)}/trash`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Gmail trash failed:", res.status, await res.text().catch(() => ""));
    if (res.status === 403) {
      return { ok: false, error: "I don't have permission to move mail to Trash yet — reconnect Google to grant it." };
    }
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}

/* Undo a Trash — restore the conversation from Trash back to the inbox. */
export async function untrashThread(threadId: string): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  if (!threadId) return { ok: false, error: "no conversation specified." };

  const res = await fetch(`${GMAIL}/threads/${encodeURIComponent(threadId)}/untrash`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("Gmail untrash failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}

/* Stage a brand-new draft in Gmail (never sent). */
export async function createEmailDraft(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}): Promise<DraftResult> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  if (!input.to?.trim()) return { ok: false, error: "a recipient is needed." };

  const raw = buildRaw({
    to: input.to.trim(),
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject ?? "",
    body: input.body ?? "",
  });
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
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, draftId: data.id };
}

/* Stage a reply draft threaded to the original message (never sent). The user's
   edits to To/Subject win; blank ones fall back to the original's values. */
export async function createReplyDraft(input: {
  messageId: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body: string;
}): Promise<DraftResult> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  const ctx = await replyContext(token, input.messageId);
  if (!ctx) return { ok: false, error: "I couldn't read the original email." };

  const raw = buildRaw({
    to: input.to?.trim() || ctx.to,
    cc: input.cc,
    bcc: input.bcc,
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
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, draftId: data.id };
}

/* Read a saved draft's content (To/Cc/Bcc/Subject/Body) so the composer can
   reopen it for review. */
export async function getDraft(
  draftId: string,
): Promise<
  | { ok: true; to: string; cc: string; bcc: string; subject: string; body: string }
  | { ok: false; error: string }
> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };

  const res = await fetch(`${GMAIL}/drafts/${encodeURIComponent(draftId)}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Gmail returned ${res.status}.` };

  const data = (await res.json()) as {
    message?: { payload?: Part & { headers?: { name: string; value: string }[] } };
  };
  const payload = data.message?.payload;
  const headers = payload?.headers ?? [];
  const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

  const acc: { mime: string; data: string }[] = [];
  collectParts(payload, acc);
  const plain = acc.find((a) => a.mime === "text/plain");
  let body = "";
  if (plain) body = decodePart(plain.data);
  else if (acc[0]) body = decodePart(acc[0].data).replace(/<[^>]+>/g, " ");
  body = body.replace(/\r\n/g, "\n").trim();

  return { ok: true, to: get("To"), cc: get("Cc"), bcc: get("Bcc"), subject: get("Subject"), body };
}

/* Delete a Gmail draft (used by "Discard"). gmail.compose covers draft
   deletion, so no extra permission is needed. The original email is untouched
   and stays unread. */
export async function deleteDraft(draftId: string): Promise<Result> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google isn't connected." };
  if (!draftId) return { ok: false, error: "no draft specified." };
  const res = await fetch(`${GMAIL}/drafts/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    // eslint-disable-next-line no-console
    console.error("Gmail draft delete failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `Gmail returned ${res.status}.` };
  }
  return { ok: true };
}

/* Explicit send — only used when the user clearly says "send it" and confirms.
   With messageId it sends as a threaded reply; otherwise a new message. */
export async function sendEmail(input: {
  to: string;
  cc?: string;
  bcc?: string;
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

  const raw = buildRaw({
    to,
    cc: input.cc,
    bcc: input.bcc,
    subject,
    body: input.body ?? "",
    inReplyTo,
    references,
  });
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
