import type { ReactNode } from "react";

export default function ModuleHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  // Compact sizing to match the marketing cockpit — one consistent scale app-wide.
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-peri-soft text-peri-deep [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <div className="flex items-baseline gap-2">
          <h1 className="text-[19px] font-medium tracking-tight">{title}</h1>
          <p className="text-[12px] text-muted">{subtitle}</p>
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
