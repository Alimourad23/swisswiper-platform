"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Read-only Google scopes we request alongside basic profile/email.
   gmail.readonly + calendar.readonly — we can read, never modify. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export default function GoogleAuthButton({
  label = "Sign in with Google",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "inline";
}) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: GOOGLE_SCOPES,
        // offline + consent => Google returns a refresh token we can store.
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      setLoading(false);
      // eslint-disable-next-line no-console
      console.error("Google sign-in failed:", error.message);
    }
    // On success the browser is redirected to Google.
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
