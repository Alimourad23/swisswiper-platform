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
  return (
    <div className="sw-card flex items-start justify-between gap-4 px-7 py-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-peri-soft text-peri-deep">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
