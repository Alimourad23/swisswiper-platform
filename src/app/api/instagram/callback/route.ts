import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearInstagramTokenCache, getInstagramProfile } from "@/lib/instagram/client";

/* "Reconnect Instagram" — step 2: Instagram redirects back here with a code.
   Exchange it for a short-lived token, then a long-lived (~60 day) one, store
   it in instagram_tokens (service-role only), and bounce back to the
   Instagram analytics page. From then on the token auto-refreshes — no more
   manual 60-day renewals. */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/dashboard/marketing/instagram?${q}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const code = url.searchParams.get("code");
  if (!code) return back("error=Instagram%20didn%27t%20return%20a%20code");

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const admin = createAdminClient();
  if (!appId || !appSecret || !admin) {
    return back("error=Instagram%20app%20credentials%20aren%27t%20configured");
  }

  try {
    // 1. code → short-lived token
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/instagram/callback`,
        code,
      }),
      cache: "no-store",
    });
    const shortJson = (await shortRes.json().catch(() => ({}))) as {
      access_token?: string;
      error_message?: string;
    };
    if (!shortRes.ok || !shortJson.access_token) {
      return back(`error=${encodeURIComponent(shortJson.error_message || "Token exchange failed")}`);
    }

    // 2. short-lived → long-lived (~60 days, refreshable)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
        appSecret,
      )}&access_token=${encodeURIComponent(shortJson.access_token)}`,
      { cache: "no-store" },
    );
    const longJson = (await longRes.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!longRes.ok || !longJson.access_token) {
      return back("error=Couldn%27t%20get%20a%20long-lived%20token");
    }

    // 3. store (single row), then verify who we're connected as.
    await admin.from("instagram_tokens").upsert(
      {
        id: 1,
        access_token: longJson.access_token,
        expires_at: new Date(Date.now() + (longJson.expires_in ?? 5_184_000) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    clearInstagramTokenCache();

    try {
      const profile = await getInstagramProfile();
      await admin.from("instagram_tokens").update({ connected_username: profile.username }).eq("id", 1);
    } catch {
      /* username label is a nice-to-have */
    }

    return back("connected=1");
  } catch {
    return back("error=Something%20went%20wrong%20connecting%20Instagram");
  }
}
