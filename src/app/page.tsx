import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="sw-card flex w-full max-w-md flex-col items-center px-9 py-14 text-center">
        {/* Wordmark */}
        <h1 className="text-4xl font-medium tracking-tight">SwissWiper</h1>

        {/* Tagline */}
        <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
          The performance platform. Everything that matters, in one calm place.
        </p>

        {/* Real Google OAuth sign-in. */}
        <GoogleSignInButton />

        <p className="mt-6 text-xs text-hint">Invite-only access for the SwissWiper team.</p>
      </div>
    </main>
  );
}
