import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Runs on every matched request (from src/proxy.ts):
   1. Refreshes the Supabase session cookie so logins don't silently expire.
   2. Protects /dashboard and /bridge — signed-out visitors are sent to the
      sign-in page. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect the dashboard, the Bridge and all their sub-pages.
  const path = request.nextUrl.pathname;
  const onProtected = path.startsWith("/dashboard") || path.startsWith("/bridge");

  if (!user && onProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Force sign-out for a deactivated teammate: the moment they hit a protected
  // page, revoke their sessions (all devices) and bounce them to sign-in — so a
  // deactivation takes effect immediately, not just on their next login.
  if (user && onProtected) {
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
    if (((prof as { status?: string } | null)?.status ?? "active") === "deactivated") {
      await supabase.auth.signOut(); // global: clears this session's cookie + revokes refresh tokens
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "?deactivated=1";
      const res = NextResponse.redirect(url);
      // Carry the cookie-clearing (queued onto supabaseResponse by signOut) onto the redirect.
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
      return res;
    }
  }

  return supabaseResponse;
}
