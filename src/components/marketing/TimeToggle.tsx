"use client";

export const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 365, label: "365 days" },
];

export default function TimeToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-control)] border border-hairline bg-surface p-0.5">
      {WINDOWS.map((w) => (
        <button
          key={w.days}
          type="button"
          onClick={() => onChange(w.days)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-sm transition-colors",
            value === w.days ? "bg-peri-soft font-medium text-peri-deep" : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
