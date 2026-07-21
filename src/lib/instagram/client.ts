import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* Instagram — shared foundation client (like `src/lib/google/tokens.ts`).

   Talks to the Instagram API with Instagram Login (host: graph.instagram.com).
   Auth model v1: ONE brand account (@swisswiper) via a long-lived access token
   generated in the Meta app dashboard and stored server-side in the env var
   INSTAGRAM_ACCESS_TOKEN (never reaches the browser). Long-lived tokens last
   ~60 days; a "Reconnect Instagram" OAuth flow (like Reconnect Google) is the
   planned v2 — until then, regenerate the token in the Meta dashboard and
   update the env var if publishing starts failing with an auth error.

   Modules never call Meta directly — they go through these functions, so
   swapping the auth model later cannot touch module code. */

const IG_HOST = "https://graph.instagram.com";
/* Pinned Graph API version (Meta supports each for ~2 years). */
const IG_VERSION = "v23.0";

type IgError = { error?: { message?: string; code?: number; error_subcode?: number } };

export function getInstagramToken(): string | null {
  return process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null;
}

/* Token resolution order: (1) the DB row written by the "Reconnect Instagram"
   OAuth flow (auto-refreshed near expiry), (2) the INSTAGRAM_ACCESS_TOKEN env
   var as fallback. Cached in memory for 10 minutes. */
let tokenCache: { token: string; at: number } | null = null;

async function resolveInstagramToken(): Promise<string | null> {
  if (tokenCache && Date.now() - tokenCache.at < 10 * 60_000) return tokenCache.token;
  const admin = createAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("instagram_tokens")
        .select("access_token, expires_at, updated_at")
        .eq("id", 1)
        .maybeSingle();
      const row = data as { access_token?: string; expires_at?: string; updated_at?: string } | null;
      if (row?.access_token) {
        let tok = row.access_token;
        // Best-effort refresh: token older than a day AND within 15 days of expiry.
        const exp = row.expires_at ? Date.parse(row.expires_at) : 0;
        const upd = row.updated_at ? Date.parse(row.updated_at) : 0;
        if (exp && exp - Date.now() < 15 * 86_400_000 && Date.now() - upd > 86_400_000) {
          try {
            const r = await fetch(
              `${IG_HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok)}`,
              { cache: "no-store" },
            );
            const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
            if (r.ok && j.access_token) {
              tok = j.access_token;
              await admin
                .from("instagram_tokens")
                .update({
                  access_token: tok,
                  expires_at: new Date(Date.now() + (j.expires_in ?? 5_184_000) * 1000).toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", 1);
            }
          } catch {
            /* refresh is best-effort; the current token may still work */
          }
        }
        tokenCache = { token: tok, at: Date.now() };
        return tok;
      }
    } catch {
      /* table may not exist yet — fall through to env */
    }
  }
  const env = process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null;
  if (env) tokenCache = { token: env, at: Date.now() };
  return env;
}

/* Is any Instagram connection available (DB or env)? */
export async function hasInstagramConnection(): Promise<boolean> {
  return (await resolveInstagramToken()) !== null;
}

/* Called by the OAuth callback after storing a fresh token. */
export function clearInstagramTokenCache(): void {
  tokenCache = null;
}

/* One fetch wrapper: builds the URL, attaches the token, surfaces Meta's error
   message as a thrown Error (friendly text, no token leakage). */
async function igFetch<T>(
  path: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const token = await resolveInstagramToken();
  if (!token) throw new Error("Instagram isn't connected yet — use Reconnect Instagram, or set INSTAGRAM_ACCESS_TOKEN.");

  const url = new URL(`${IG_HOST}/${IG_VERSION}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: token });

  let res: Response;
  if (method === "GET") {
    url.search = body.toString();
    res = await fetch(url, { cache: "no-store" });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  }

  const json = (await res.json().catch(() => ({}))) as T & IgError;
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Instagram API error (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return json;
}

/* ---- Account ---------------------------------------------------------- */

export type IgProfile = { userId: string; username: string };

/* Who is connected? Used for display ("Connected as @swisswiper") and to get
   the IG user id every publish call needs. */
export async function getInstagramProfile(): Promise<IgProfile> {
  const me = await igFetch<{ user_id?: string; id?: string; username: string }>("me", {
    fields: "user_id,username",
  });
  return { userId: String(me.user_id ?? me.id), username: me.username };
}

/* ---- Analytics (live reads; used by the marketing module) -------------- */

export type IgAccountStats = {
  userId: string;
  username: string;
  followersCount: number;
  mediaCount: number;
};

/* Followers + post count straight from the account — one call. */
export async function getInstagramAccountStats(): Promise<IgAccountStats> {
  const me = await igFetch<{
    user_id?: string;
    id?: string;
    username: string;
    followers_count?: number;
    media_count?: number;
  }>("me", { fields: "user_id,username,followers_count,media_count" });
  return {
    userId: String(me.user_id ?? me.id),
    username: me.username,
    followersCount: me.followers_count ?? 0,
    mediaCount: me.media_count ?? 0,
  };
}

export type IgMediaItem = {
  id: string;
  caption: string;
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
};

/* The account's recent posts with per-post likes + comments — covers posts
   published by the platform AND posts made directly in the Instagram app. */
export async function getRecentMedia(limit = 24): Promise<IgMediaItem[]> {
  const r = await igFetch<{
    data?: {
      id: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }[];
  }>("me/media", {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return (r.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption ?? "",
    mediaType: m.media_type ?? "IMAGE",
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
    permalink: m.permalink ?? "",
    timestamp: m.timestamp ?? "",
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
  }));
}

/* 28-day account reach — BEST-EFFORT. Account-level insights may require the
   Facebook-login API variant; when unavailable we return null and the UI simply
   doesn't show the card (honest, no fake zeros). */
export async function tryAccountReach28(igUserId: string): Promise<number | null> {
  try {
    const r = await igFetch<{ data?: { values?: { value?: number }[] }[] }>(`${igUserId}/insights`, {
      metric: "reach",
      period: "days_28",
    });
    const vals = r.data?.[0]?.values;
    const v = vals && vals.length ? vals[vals.length - 1]?.value : undefined;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export type IgAccountInsightTotals = {
  views: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
};

async function totalValueMetric(igUserId: string, metric: string, since: number, until: number): Promise<number | null> {
  try {
    const r = await igFetch<{ data?: { total_value?: { value?: number } }[] }>(`${igUserId}/insights`, {
      metric,
      metric_type: "total_value",
      period: "day",
      since: String(since),
      until: String(until),
    });
    const v = r.data?.[0]?.total_value?.value;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/* 28-day account totals — each metric best-effort (null when unavailable). */
export async function tryAccountInsightTotals(igUserId: string): Promise<IgAccountInsightTotals> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 86_400;
  const [views, profileViews, accountsEngaged] = await Promise.all([
    totalValueMetric(igUserId, "views", since, until),
    totalValueMetric(igUserId, "profile_views", since, until),
    totalValueMetric(igUserId, "accounts_engaged", since, until),
  ]);
  return { views, profileViews, accountsEngaged };
}

export type IgMediaInsights = { reach: number | null; saved: number | null };

/* Per-post reach + saves — best-effort per post. */
export async function tryMediaInsights(mediaId: string): Promise<IgMediaInsights> {
  try {
    const r = await igFetch<{ data?: { name?: string; values?: { value?: number }[] }[] }>(`${mediaId}/insights`, {
      metric: "reach,saved",
    });
    const get = (n: string): number | null => {
      const e = r.data?.find((d) => d.name === n);
      const v = e?.values?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    return { reach: get("reach"), saved: get("saved") };
  } catch {
    return { reach: null, saved: null };
  }
}

export type IgDemographics = { breakdown: string; entries: { name: string; value: number }[] } | null;

/* Follower demographics by country — Instagram only provides these once the
   account passes ~100 followers; null until then. */
export async function tryFollowerDemographics(igUserId: string): Promise<IgDemographics> {
  try {
    const r = await igFetch<{
      data?: { total_value?: { breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] } }[];
    }>(`${igUserId}/insights`, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown: "country",
    });
    const results = r.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    const entries = results
      .map((x) => ({ name: (x.dimension_values ?? []).join(" "), value: Number(x.value ?? 0) }))
      .filter((e) => e.name)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return entries.length ? { breakdown: "country", entries } : null;
  } catch {
    return null;
  }
}

/* ---- Engagement: comments + direct messages ---------------------------- */

export type IgCommentReply = { id: string; text: string; username: string; timestamp: string };

export type IgComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount: number;
  replies: IgCommentReply[];
};

/* Comments on one post (with their replies, so we can tell what's answered). */
export async function getMediaComments(mediaId: string): Promise<IgComment[]> {
  const r = await igFetch<{
    data?: {
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
      like_count?: number;
      replies?: { data?: { id: string; text?: string; username?: string; timestamp?: string }[] };
    }[];
  }>(`${mediaId}/comments`, {
    fields: "id,text,username,timestamp,like_count,replies{id,text,username,timestamp}",
    limit: "25",
  });
  return (r.data ?? []).map((c) => ({
    id: c.id,
    text: c.text ?? "",
    username: c.username ?? "",
    timestamp: c.timestamp ?? "",
    likeCount: c.like_count ?? 0,
    replies: (c.replies?.data ?? []).map((x) => ({
      id: x.id,
      text: x.text ?? "",
      username: x.username ?? "",
      timestamp: x.timestamp ?? "",
    })),
  }));
}

/* Publish a reply under a comment. */
export async function replyToComment(commentId: string, message: string): Promise<string> {
  const r = await igFetch<{ id: string }>(`${commentId}/replies`, { message }, "POST");
  return r.id;
}

export type IgMessage = { id: string; text: string; fromId: string; createdTime: string };

export type IgConversation = {
  id: string;
  participantId: string;
  participantUsername: string;
  updatedTime: string;
  messages: IgMessage[];
};

/* Recent DM conversations with their latest messages (newest first). */
export async function getConversations(selfUserId: string): Promise<IgConversation[]> {
  const r = await igFetch<{
    data?: {
      id: string;
      updated_time?: string;
      participants?: { data?: { id?: string; username?: string }[] };
      messages?: { data?: { id: string; message?: string; from?: { id?: string }; created_time?: string }[] };
    }[];
  }>("me/conversations", {
    platform: "instagram",
    fields: "id,updated_time,participants,messages{id,message,from,created_time}",
    limit: "10",
  });
  return (r.data ?? []).map((c) => {
    const other = (c.participants?.data ?? []).find((p) => String(p.id) !== selfUserId);
    return {
      id: c.id,
      participantId: String(other?.id ?? ""),
      participantUsername: other?.username ?? "customer",
      updatedTime: c.updated_time ?? "",
      messages: (c.messages?.data ?? [])
        .map((m) => ({
          id: m.id,
          text: m.message ?? "",
          fromId: String(m.from?.id ?? ""),
          createdTime: m.created_time ?? "",
        }))
        .slice(0, 12),
    };
  });
}

/* Send a DM (allowed within 24h of the customer's last message — Meta's rule). */
export async function sendDirectMessage(igUserId: string, recipientId: string, text: string): Promise<void> {
  await igFetch<{ message_id?: string }>(
    `${igUserId}/messages`,
    { recipient: JSON.stringify({ id: recipientId }), message: JSON.stringify({ text }) },
    "POST",
  );
}

/* ---- Publishing (two-step: create a media container, then publish) ---- */

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

/* Step 1a — image post. The image must be a PUBLIC url (our Supabase
   marketing-media bucket is public, so post media qualifies). JPEG only per
   Meta; PNGs from the bucket generally convert fine on Meta's side. */
export async function createImageContainer(
  igUserId: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  const r = await igFetch<{ id: string }>(
    `${igUserId}/media`,
    { image_url: imageUrl, caption },
    "POST",
  );
  return r.id;
}

/* Step 1b — video post (published as a Reel — Instagram's only feed-video
   type). Processing is async and can take minutes. */
export async function createVideoContainer(
  igUserId: string,
  videoUrl: string,
  caption: string,
): Promise<string> {
  const r = await igFetch<{ id: string }>(
    `${igUserId}/media`,
    { media_type: "REELS", video_url: videoUrl, caption },
    "POST",
  );
  return r.id;
}

/* Step 1c — one item of a carousel (image). */
export async function createCarouselItemContainer(igUserId: string, imageUrl: string): Promise<string> {
  const r = await igFetch<{ id: string }>(
    `${igUserId}/media`,
    { image_url: imageUrl, is_carousel_item: "true" },
    "POST",
  );
  return r.id;
}

/* Step 1d — the carousel itself (2–10 processed item containers). */
export async function createCarouselContainer(
  igUserId: string,
  childIds: string[],
  caption: string,
): Promise<string> {
  const r = await igFetch<{ id: string }>(
    `${igUserId}/media`,
    { media_type: "CAROUSEL", children: childIds.join(","), caption },
    "POST",
  );
  return r.id;
}

/* Step 1e — a Story (image or video). Instagram ignores captions on Stories. */
export async function createStoryContainer(
  igUserId: string,
  media: { imageUrl?: string; videoUrl?: string },
): Promise<string> {
  const params: Record<string, string> = { media_type: "STORIES" };
  if (media.imageUrl) params.image_url = media.imageUrl;
  else if (media.videoUrl) params.video_url = media.videoUrl;
  const r = await igFetch<{ id: string }>(`${igUserId}/media`, params, "POST");
  return r.id;
}

/* Between steps — poll until the container is ready (FINISHED). */
export async function getContainerStatus(containerId: string): Promise<ContainerStatus> {
  const r = await igFetch<{ status_code?: ContainerStatus }>(containerId, {
    fields: "status_code",
  });
  return r.status_code ?? "IN_PROGRESS";
}

/* Step 2 — publish the container. Returns the Instagram media id. */
export async function publishContainer(igUserId: string, containerId: string): Promise<string> {
  const r = await igFetch<{ id: string }>(
    `${igUserId}/media_publish`,
    { creation_id: containerId },
    "POST",
  );
  return r.id;
}

/* After publishing — the public link to the post (for the UI). */
export async function getMediaPermalink(mediaId: string): Promise<string | null> {
  try {
    const r = await igFetch<{ permalink?: string }>(mediaId, { fields: "permalink" });
    return r.permalink ?? null;
  } catch {
    return null; // permalink is a nice-to-have; never fail a publish over it
  }
}
