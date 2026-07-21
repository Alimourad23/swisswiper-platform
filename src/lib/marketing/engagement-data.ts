import "server-only";
import {
  getConversations,
  getInstagramAccountStats,
  getMediaComments,
  getRecentMedia,
  hasInstagramConnection,
} from "@/lib/instagram/client";

/* The engagement inbox — comments + DMs, fetched LIVE from Instagram on every
   page view (v1, no webhooks needed). Replies are drafted by Alfred and sent
   only after a human approves — never automatically.

   Single entry point per the module rule: the UI calls getEngagementView(). */

export type EngageComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount: number;
  /** true when @swisswiper already replied under it. */
  replied: boolean;
  replies: { id: string; text: string; username: string; timestamp: string }[];
  post: { id: string; caption: string; permalink: string; thumb: string | null };
};

export type EngageThread = {
  id: string;
  participantId: string;
  username: string;
  updatedTime: string;
  /** Meta's rule: replying is allowed within 24h of the customer's last message. */
  canReply: boolean;
  /** true when the last message in the thread is from us. */
  answered: boolean;
  messages: { id: string; text: string; fromMe: boolean; createdTime: string }[];
};

export type EngagementView =
  | { connected: false; reason: string }
  | {
      connected: true;
      username: string;
      comments: EngageComment[];
      threads: EngageThread[];
      commentsError: string | null;
      dmError: string | null;
    };

/* How many recent posts to scan for comments (1 API call each). */
const POSTS_TO_SCAN = 8;

export async function getEngagementView(): Promise<EngagementView> {
  if (!(await hasInstagramConnection())) {
    return { connected: false, reason: "Instagram isn't connected yet." };
  }

  try {
    const stats = await getInstagramAccountStats();
    const self = stats.username.toLowerCase();

    // Comments across the recent posts.
    let comments: EngageComment[] = [];
    let commentsError: string | null = null;
    try {
      const media = (await getRecentMedia(POSTS_TO_SCAN)).slice(0, POSTS_TO_SCAN);
      const perPost = await Promise.all(
        media.map(async (m) => {
          try {
            const list = await getMediaComments(m.id);
            return list
              .filter((c) => c.username.toLowerCase() !== self) // our own comments aren't inbox items
              .map((c) => ({
                id: c.id,
                text: c.text,
                username: c.username,
                timestamp: c.timestamp,
                likeCount: c.likeCount,
                replied: c.replies.some((r) => r.username.toLowerCase() === self),
                replies: c.replies,
                post: {
                  id: m.id,
                  caption: m.caption,
                  permalink: m.permalink,
                  thumb: m.mediaType === "VIDEO" ? m.thumbnailUrl : m.mediaUrl ?? m.thumbnailUrl,
                },
              }));
          } catch {
            return [];
          }
        }),
      );
      comments = perPost
        .flat()
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    } catch (e) {
      commentsError = e instanceof Error ? e.message : "Couldn't load comments.";
    }

    // DM conversations.
    let threads: EngageThread[] = [];
    let dmError: string | null = null;
    try {
      const convos = await getConversations(stats.userId);
      threads = convos.map((c) => {
        const msgs = [...c.messages].sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || ""));
        const mapped = msgs.map((m) => ({
          id: m.id,
          text: m.text,
          fromMe: m.fromId === stats.userId,
          createdTime: m.createdTime,
        }));
        const lastInbound = [...mapped].reverse().find((m) => !m.fromMe);
        const canReply = lastInbound
          ? Date.now() - Date.parse(lastInbound.createdTime) < 24 * 3600_000
          : false;
        const last = mapped[mapped.length - 1];
        return {
          id: c.id,
          participantId: c.participantId,
          username: c.participantUsername,
          updatedTime: c.updatedTime,
          canReply,
          answered: Boolean(last?.fromMe),
          messages: mapped,
        };
      });
    } catch (e) {
      dmError = e instanceof Error ? e.message : "Couldn't load messages.";
    }

    return { connected: true, username: stats.username, comments, threads, commentsError, dmError };
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : "Instagram is unreachable right now." };
  }
}
