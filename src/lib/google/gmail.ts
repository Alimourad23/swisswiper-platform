/* Gmail REST helpers — STRICTLY READ-ONLY.
   We only ever issue GET requests against the Gmail API. Nothing here can
   delete, archive, send, or modify mail. */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

// How many recent inbox messages we classify + display. The "Need attention"
// count and the triaged list are BOTH derived from this same set, so they can
// never disagree (no window mismatch).
const INBOX_WINDOW = 18;

async function gget<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Gmail GET ${path} -> ${res.status}`);
  }
  // Gmail can return an empty body when a filtered query matches nothing
  // (e.g. a `fields=` request with zero results). Treat that as {}.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

const metadataPath = (id: string) =>
  `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;

/* Senders that are clearly automated / not a real person. */
const AUTOMATED_SENDER =
  /(no-?reply|do-?not-?reply|no_reply|donotreply|notifications?|newsletter|mailer|mailer-daemon|bounce|postmaster|automated)/i;

/* Count messages matching a Gmail search query by actually listing the message
   IDs (paginated) — NOT the inaccurate resultSizeEstimate. */
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

export type TriagedThread = {
  id: string;
  senderName: string;
  subject: string;
  date: string; // ISO
  unread: boolean;
  tag: TriageTag;
};

export type InboxView = {
  unread: number; // exact unread-in-inbox count (from the INBOX label)
  week: number; // real count of messages received in the last 7 days
  needAttention: number; // == number of "priority" items in `threads`
  threads: TriagedThread[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
};

/* THE single source of truth. An email is "priority" / "needs attention" iff:
   unread + in the Primary category + from a real person (not promo/social/
   automated). "safe" is a delete *suggestion* only; everything else is untagged. */
function classify(msg: GmailMessage): TriageTag {
  const labels = msg.labelIds ?? [];
  const unread = labels.includes("UNREAD");
  const promotions = labels.includes("CATEGORY_PROMOTIONS");
  const social = labels.includes("CATEGORY_SOCIAL");
  const updates = labels.includes("CATEGORY_UPDATES");
  const forums = labels.includes("CATEGORY_FORUMS");
  const personal = labels.includes("CATEGORY_PERSONAL");

  const { email } = parseFrom(header(msg, "From"));
  const automated = AUTOMATED_SENDER.test(email);

  // Primary = Gmail's Personal category, or no non-primary category at all.
  const isPrimary = personal || !(promotions || social || updates || forums);

  if (unread && isPrimary && !automated) return "priority";
  if (promotions || social || automated) return "safe";
  return null;
}

function toThread(msg: GmailMessage): TriagedThread {
  const { name } = parseFrom(header(msg, "From"));

  const dateHeader = header(msg, "Date");
  let date = new Date(dateHeader);
  if (isNaN(date.getTime()) && msg.internalDate) {
    date = new Date(Number(msg.internalDate));
  }

  return {
    id: msg.id,
    senderName: name,
    subject: header(msg, "Subject") || "(no subject)",
    date: isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
    unread: (msg.labelIds ?? []).includes("UNREAD"),
    tag: classify(msg),
  };
}

/* Builds the whole Emails view from ONE classified set of messages, so the
   "Need attention" count is exactly the number of Priority-tagged items shown. */
export async function getInboxView(token: string): Promise<InboxView> {
  const [inbox, week, threads] = await Promise.all([
    gget<{ messagesUnread?: number }>(token, "/labels/INBOX"),
    countMessages(token, "in:inbox newer_than:7d"),
    fetchClassifiedThreads(token, INBOX_WINDOW),
  ]);

  // "Need attention" is, by construction, the number of Priority-tagged items
  // in `threads` — so the count and the tags can never disagree.
  const needAttention = threads.filter((t) => t.tag === "priority").length;

  return {
    unread: inbox.messagesUnread ?? 0,
    week,
    needAttention,
    threads,
  };
}

async function fetchClassifiedThreads(token: string, max: number): Promise<TriagedThread[]> {
  const list = await gget<{ messages?: { id: string }[] }>(
    token,
    "/messages?maxResults=" + max + "&q=" + encodeURIComponent("in:inbox"),
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  const messages = await Promise.all(ids.map((id) => gget<GmailMessage>(token, metadataPath(id))));
  return messages.map(toThread);
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
