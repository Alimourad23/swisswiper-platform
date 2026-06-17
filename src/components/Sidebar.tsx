"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { founderNav, comingSoonNav } from "@/lib/modules";
import { LivePill, SoonPill } from "@/components/Pill";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-hint">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-surface md:flex">
      <nav className="flex flex-1 flex-col gap-6 p-4">
        {/* Founder view — live, clickable */}
        <div>
          <SectionLabel>Founder view</SectionLabel>
          <div className="flex flex-col gap-1">
            {founderNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href!}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors duration-150",
                    active
                      ? "bg-peri-soft font-medium text-peri-deep"
                      : "text-muted hover:bg-bg hover:text-ink",
                  ].join(" ")}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.name}</span>
                  {item.live && <LivePill />}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Coming soon — shaded, not clickable */}
        <div>
          <SectionLabel>Coming soon</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {comingSoonNav.map((item) => (
              <div
                key={item.name}
                aria-disabled="true"
                title="Coming soon"
                className="flex cursor-default select-none items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-[rgba(92,102,166,0.28)] bg-peri-soft/60 px-3 py-2.5 text-sm text-hint"
              >
                <span className="shrink-0 opacity-70">{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                <SoonPill />
              </div>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
