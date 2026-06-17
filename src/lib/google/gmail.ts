/* Gmail REST helpers — STRICTLY READ-ONLY.
   Only GET requests against the Gmail API. Nothing here can delete, archive,
   send, or modify mail.

   This module fetches raw thread data and computes timezone-independent facts
   (triage tag, awaiting-reply). Received times are formatted on the CLIENT in
   the viewer's device timezone. */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

// Recent inbox messages we classify + display. The need-attention / safe /
// awaiting counts are derived from this same set, so list and counts agree.
const INBOX_WINDOW = 18;

async function gget<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Gmail GET ${path} -> ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

const metadataPath = (id: string) =>
  `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`;

const AUTOMATED_SENDER =
  /(no-?reply|do-?not-?reply|no_reply|donotreply|notifications?|newsletter|mailer|mailer-daemon|bounce|postmaster|automated)/i;

async function countMessages(token: string, query: string, cap = 5000): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      q: query,
      maxResults: "500",
      fields: "messages/id,nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await gget<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      "/messages?" + params.toString(),
    );
    count += data.messages?.length ?? 0;
    if (count >= cap || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return count;
}

export type TriageTag = "priority" | "safe" | null;

export type EmailThread = {
  id: string;
  threadId: string;
  senderName: string;
  subject: string;
  snippet: string; // one-line body preview from Gmail
  dateISO: string; // received time (formatted on the client)
  unread: boolean;
  tag: TriageTag;
  awaitingReply: boolean; // unread + Primary + real person + addressed to me (best-effort)
  gmailUrl: string; // deep link to open the thread in Gmail
};

export type InboxView = {
  unread: number;
  week: number;
  needAttention: number;
  safeToDelete: number;
  awaitingReply: number;
  threads: EmailThread[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
};

export async function getInboxView(token: string): Promise<InboxView> {
  const [profile, inbox, week, messages] = await Promise.all([
    gget<{ emailAddress?: string }>(token, "/profile"),
    gget<{ messagesUnread?: number }>(token, "/labels/INBOX"),
    countMessages(token, "in:inbox newer_than:7d"),
    fetchMessages(token, INBOX_WINDOW),
  ]);

  const myEmail = (profile.emailAddress ?? "").toLowerCase();
  const threads = messages.map((m) => toThread(m, myEmail));

  return {
    unread: inbox.messagesUnread ?? 0,
    week,
    needAttention: threads.filter((t) => t.tag === "priority").length,
    safeToDelete: threads.filter((t) => t.tag === "safe").length,
    awaitingReply: threads.filter((t) => t.awaitingReply).length,
    threads,
  };
}

async function fetchMessages(token: string, max: number): Promise<GmailMessage[]> {
  const list = await gget<{ messages?: { id: string }[] }>(
    token,
    "/messages?maxResults=" + max + "&q=" + encodeURIComponent("in:inbox"),
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  return Promise.all(ids.map((id) => gget<GmailMessage>(token, metadataPath(id))));
}

function toThread(msg: GmailMessage, myEmail: string): EmailThread {
  const labels = msg.labelIds ?? [];
  const unread = labels.includes("UNREAD");
  const promotions = labels.includes("CATEGORY_PROMOTIONS");
  const social = labels.includes("CATEGORY_SOCIAL");
  const updates = labels.includes("CATEGORY_UPDATES");
  const forums = labels.includes("CATEGORY_FORUMS");
  const personal = labels.includes("CATEGORY_PERSONAL");

  const { name, email } = parseFrom(header(msg, "From"));
  const automated = AUTOMATED_SENDER.test(email);
  const isPrimary = personal || !(promotions || social || updates || forums);

  let tag: TriageTag = null;
  if (promotions || social || automated) tag = "safe";
  else if (unread && isPrimary && !automated) tag = "priority";

  const addressedToMe = !!myEmail && header(msg, "To").toLowerCase().includes(myEmail);
  const awaitingReply = unread && isPrimary && !automated && addressedToMe;

  const dateHeader = header(msg, "Date");
  let date = new Date(dateHeader);
  if (isNaN(date.getTime()) && msg.internalDate) date = new Date(Number(msg.internalDate));

  return {
    id: msg.id,
    threadId: msg.threadId,
    senderName: name,
    subject: header(msg, "Subject") || "(no subject)",
    snippet: decodeEntities(msg.snippet ?? ""),
    dateISO: isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
    unread,
    tag,
    awaitingReply,
    gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`,
  };
}

function header(msg: GmailMessage, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const email = m[2].trim().toLowerCase();
    return { name: m[1].trim() || email, email };
  }
  const email = from.trim().toLowerCase();
  return { name: from.trim() || email, email };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}
