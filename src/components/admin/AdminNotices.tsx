/* Shared empty/blocked states for the admin panel. */

export function NotAuthorised() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className="sw-card flex flex-col items-start gap-2 p-6">
        <h3 className="text-[15px] font-medium">Admin only</h3>
        <p className="text-sm text-muted">
          This area is for founders and admins. If you need access, ask a founder to raise your role on the People page.
        </p>
      </div>
    </div>
  );
}

export function SetupNote({ reason }: { reason?: string }) {
  if (reason === "no_service_role") {
    return (
      <div className="sw-card flex flex-col items-start gap-2 p-6">
        <h3 className="text-[14px] font-medium">One setup step left</h3>
        <p className="text-sm text-muted">
          The admin panel needs the <code className="rounded bg-bg px-1 py-0.5 text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code> environment variable set on Vercel
          (it lists every teammate securely). Add it in Vercel → Settings → Environment Variables, redeploy, and this fills in.
        </p>
      </div>
    );
  }
  return (
    <div className="sw-card flex flex-col items-start gap-2 p-6">
      <h3 className="text-[14px] font-medium">Nothing to show yet</h3>
      <p className="text-sm text-muted">Once teammates sign in, they&apos;ll appear here.</p>
    </div>
  );
}

/* A small shield icon for the admin header. */
export const adminIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    <path d="m9.5 12 1.8 1.8L15 10" />
  </svg>
);
