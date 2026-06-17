import type { ReactNode } from "react";

/* Honest "ready / connect" empty state for a live module whose data source
   isn't wired up yet. No fabricated content. The button is a visual
   placeholder — real connecting arrives with Google sign-in. */
export default function ConnectState({
  icon,
  message,
  ctaLabel,
  compact = false,
}: {
  icon?: ReactNode;
  message: string;
  ctaLabel: string;
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
      <button
        type="button"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-peri-deep px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#4d5793] focus:outline-none focus-visible:ring-2 focus-visible:ring-peri-deep/40"
      >
        {ctaLabel}
      </button>
      <p className="mt-3 text-xs text-hint">Available once Google sign-in is added.</p>
    </div>
  );
}
