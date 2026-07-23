import { createClient } from "@/lib/supabase/server";

/* Returns a valid Google access token for the signed-in user, or null if the
   user hasn't connected Google (with the required scopes) yet.

   How it works:
   - The long-lived Google *refresh token* is stored per-user in Supabase
     (table `google_tokens`), captured at sign-in. It never reaches the browser.
   - Google access tokens expire (~1 hour), so we exchange the refresh token for
     a fresh access token server-side, then cache it in memory until it expires. */

type CachedToken = { token: string; expiresAt: number; refreshToken: string };
const tokenCache = new Map<string, CachedToken>();

export async function getGoogleAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Read the CURRENT refresh token first. Google ties a refresh token to the
  // scopes granted when it was issued, so after a reconnect (which stores a new
  // refresh token with new scopes) we must mint a fresh access token — never
  // reuse one cached from the old token, or new scopes (e.g. Trash) 403.
  const { data: row } = await supabase
    .from("google_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  const refreshToken = (row as { refresh_token?: string } | null)?.refresh_token;
  if (!refreshToken) return null;

  // Reuse the cached token only if it was minted from the SAME refresh token and
  // is still valid (60s safety margin).
  const cached = tokenCache.get(user.id);
  if (cached && cached.refreshToken === refreshToken && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // eslint-disable-next-line no-console
    console.error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables.");
    return null;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    // eslint-disable-next-line no-console
    console.error("Google token refresh failed:", res.status, body);
    // If Google says the refresh token is dead — revoked, or (most commonly)
    // expired because the OAuth consent screen is still in "Testing" status,
    // where Google expires refresh tokens after 7 days — clear the stored token
    // so the UI shows a clean "Reconnect Google" instead of erroring on every
    // call. A transient 5xx is left untouched so we never drop a still-good token.
    if (res.status === 400 && body.includes("invalid_grant")) {
      try {
        await supabase.from("google_tokens").delete().eq("user_id", user.id);
      } catch {
        /* best-effort cleanup */
      }
      tokenCache.delete(user.id);
    }
    return null;
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresIn = json.expires_in ?? 3600;
  tokenCache.set(user.id, {
    token: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshToken,
  });
  return json.access_token;
}
