"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Google scopes we request alongside basic profile/email.
   Read: gmail.readonly + calendar.readonly.
   Write (for Alfred's actions): gmail.compose (draft/send), gmail.modify
   (move mail to Trash — recoverable) + calendar.events (create/move/cancel). */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export default function GoogleAuthButton({
  label = "Sign in with Google",
  variant = "primary",
  forceConsent = false,
}: {
  label?: string;
  variant?: "primary" | "inline" | "subtle";
  /** Force Google's consent screen — for "Reconnect Google" when the stored
   *  refresh token is lost or scopes need re-granting. Normal sign-in omits it
   *  so logins are seamless after the one-time incremental consent. */
  forceConsent?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const supabase = createClient();

    // access_type=offline → Google returns a refresh token on first/forced
    // consent. include_granted_scopes=true → incremental auth: adding the new
    // write scopes prompts ONCE, then later logins are consent-free. We only
    // add prompt=consent for an explicit reconnect.
    const queryParams: Record<string, string> = {
      access_type: "offline",
      include_granted_scopes: "true",
    };
    if (forceConsent) queryParams.prompt = "consent";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: GOOGLE_SCOPES,
        queryParams,
      },
    });
    if (error) {
      setLoading(false);
      // eslint-disable-next-line no-console
      console.error("Google sign-in failed:", error.message);
    }
    // On success the browser is redirected to Google.
  }

  if (variant === "subtle") {
    return (
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink disabled:opacity-60"
      >
        {loading ? "Connecting…" : label}
      </button>
    );
  }

  const className =
    variant === "primary"
      ? "mt-10 inline-flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-[var(--radius-control)] bg-peri px-6 text-sm font-medium text-ink transition-colors duration-200 hover:bg-[#b6c0de] focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40 disabled:opacity-70"
      : "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-peri-deep px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#4d5793] focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40 disabled:opacity-70";

  return (
    <button type="button" onClick={start} disabled={loading} className={className}>
      {variant === "primary" && <GoogleMark />}
      {loading ? "Connecting…" : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
