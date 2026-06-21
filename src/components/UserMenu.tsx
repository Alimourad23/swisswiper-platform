"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function UserMenu({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
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

      {/* Recovery for the rare case the stored Google token is lost or scopes
          need re-granting — forces the consent screen. */}
      <span className="hidden sm:inline">
        <GoogleAuthButton variant="subtle" forceConsent label="Reconnect Google" />
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
