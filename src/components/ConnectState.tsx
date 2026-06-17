import type { ReactNode } from "react";

/* Honest "ready / connect" empty state for a live module whose data source
   isn't connected yet. No fabricated content.
   - Pass `action` (a real button) when connecting is wired up.
   - Otherwise it shows a disabled placeholder button labelled `ctaLabel`. */
export default function ConnectState({
  icon,
  message,
  ctaLabel,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  message: string;
  ctaLabel?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center text-center",
        compact ? "py-10" : "py-16",
      ].join(" ")}
    >
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-peri-soft text-peri-deep">
          {icon}
        </div>
      )}
      <p className="max-w-sm text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-5">
        {action ?? (
          <button
            type="button"
            disabled
            className="inline-flex h-10 cursor-default items-center justify-center rounded-[var(--radius-control)] bg-peri-deep px-5 text-sm font-medium text-white opacity-60"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
