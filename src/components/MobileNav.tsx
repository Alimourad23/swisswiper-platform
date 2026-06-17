"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { founderNav, comingSoonNav } from "@/lib/modules";

/* Horizontal, scrollable nav shown only on small screens (sidebar is hidden).
   Live items are clickable; coming-soon items are shown shaded and disabled. */
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-hairline bg-surface px-4 py-3 md:hidden">
      {founderNav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-150",
              active ? "bg-peri-soft font-medium text-peri-deep" : "text-muted hover:bg-bg",
            ].join(" ")}
          >
            {item.name}
          </Link>
        );
      })}
      {comingSoonNav.map((item) => (
        <span
          key={item.name}
          aria-disabled="true"
          className="shrink-0 cursor-default select-none rounded-full border border-dashed border-[rgba(92,102,166,0.28)] bg-peri-soft/60 px-4 py-1.5 text-sm text-hint"
        >
          {item.name}
        </span>
      ))}
    </nav>
  );
}
