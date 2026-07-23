"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function UserMenu({
  name,
  avatarUrl,
  googleConnected = false,
}: {
  name: string;
  avatarUrl: string | null;
  googleConnected?: boolean;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {name && <span className="hidden text-sm text-muted sm:inline">{name}</span>}

      {avatarUrl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || "Profile"}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-9 w-9 rounded-full object-cover ring-1 ring-hairline"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-peri-soft text-xs font-medium text-peri-deep ring-1 ring-hairline"
        >
          {initial}
        </div>
      )}

      {/* Header Google status. When connected, a quiet confirmation (no alarm);
          the "Reconnect Google" button only appears when Google is actually
          dropped, so a healthy connection never looks unresolved. Reconnect
          forces the consent screen to mint a fresh refresh token. */}
      <span className="hidden sm:inline">
        {googleConnected ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600" title="Google is connected">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Google connected
          </span>
        ) : (
          <GoogleAuthButton variant="subtle" forceConsent label="Reconnect Google" />
        )}
      </span>

      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="rounded-[var(--radius-control)] border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-bg hover:text-ink disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
