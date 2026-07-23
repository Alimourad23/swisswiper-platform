"use client";

import type { ReactNode } from "react";

/* Wrap an editor's controls so a view-only member sees them clearly disabled
   rather than clicking into a silent rejection. A native <fieldset disabled>
   greys out and blocks every input/select/button inside it in one stroke, and a
   small ribbon explains why. When `canEdit` is true it renders children as-is. */

export default function EditGate({ canEdit, children }: { canEdit: boolean; children: ReactNode }) {
  if (canEdit) return <>{children}</>;
  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        View-only — you can read this but not change it.
      </div>
      <fieldset disabled className="min-w-0 border-0 p-0 opacity-60 [&_*]:pointer-events-none">
        {children}
      </fieldset>
    </div>
  );
}
