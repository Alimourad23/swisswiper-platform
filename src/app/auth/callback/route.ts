import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Google sends the user back here with a one-time `code`.
   We exchange it for a signed-in session, capture the Google refresh token
   (so we can call Gmail/Calendar later), then forward to the dashboard. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/bridge";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Securely store the Google refresh token for this user (server-side only).
      //
      // CRITICAL: only write when Google actually returns a refresh token.
      // Seamless (consent-free) logins do NOT return one — and overwriting the
      // stored token with null/empty would break Gmail/Calendar. So we upsert
      // ONLY when `provider_refresh_token` is present; otherwise the existing
      // token is preserved untouched.
      const session = data.session;
      const refreshToken = session?.provider_refresh_token;
      const userId = session?.user?.id;
      if (refreshToken && userId) {
        try {
          await supabase.from("google_tokens").upsert({
            user_id: userId,
            refresh_token: refreshToken,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          // Table may not exist yet — the UI will prompt to connect. Don't block login.
          // eslint-disable-next-line no-console
          console.error("Could not store Google refresh token:", e);
        }
      }

      // Upsert this person's profile (powers the assignee dropdown + @mentions
      // in the Tasks module). Pulled from the Google identity.
      //
      // IMPORTANT: `role` is deliberately NOT in this payload. An upsert only
      // updates the columns it sends, so on first sign-in `role` takes its DB
      // default ('member') and on every later sign-in the existing value is
      // preserved. Never add `role` here — that would reset founders to
      // 'member' on each login.
      const u = session?.user;
      if (u?.id) {
        const m = (u.user_metadata ?? {}) as Record<string, string | undefined>;
        try {
          await supabase.from("profiles").upsert({
            id: u.id,
            email: u.email ?? null,
            full_name: m.full_name ?? m.name ?? null,
            avatar_url: m.avatar_url ?? m.picture ?? null,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          // Table may not exist yet — don't block login.
          // eslint-disable-next-line no-console
          console.error("Could not upsert profile:", e);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
