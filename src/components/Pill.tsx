export function LivePill({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2 py-0.5 text-[11px] font-medium leading-none text-live">
      <span className="h-1.5 w-1.5 rounded-full bg-live-dot" />
      {label}
    </span>
  );
}

export function SoonPill({ label = "Soon" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-peri-soft px-2 py-0.5 text-[11px] font-medium leading-none text-peri-deep">
      {label}
    </span>
  );
}

/* Small neutral badge, e.g. "Gmail" / "Google Calendar" on a live panel. */
export function ServiceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-bg px-2 py-0.5 text-[11px] font-medium leading-none text-muted">
      {label}
    </span>
  );
}
