import "server-only";

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

/* One fetch wrapper: builds the URL, attaches the token, surfaces Meta's error
   message as a thrown Error (friendly text, no token leakage). */
async function igFetch<T>(
  path: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const token = getInstagramToken();
  if (!token) throw new Error("Instagram isn't connected yet (missing INSTAGRAM_ACCESS_TOKEN).");

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
