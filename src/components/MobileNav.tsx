"use client";

import { Fragment } from "react";
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
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const inSection =
          !!item.href && item.href !== "/dashboard" && pathname.startsWith(item.href);
        return (
          <Fragment key={item.name}>
            <Link
              href={item.href!}
              aria-current={pathname === item.href ? "page" : undefined}
              className={[
                "shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-150",
                active ? "bg-peri-soft font-medium text-peri-deep" : "text-muted hover:bg-bg",
              ].join(" ")}
            >
              {item.name}
            </Link>
            {item.children &&
              inSection &&
              item.children.map((child) => {
                const childActive = pathname === child.href;
                return (
                  <Link
                    key={child.name}
                    href={child.href!}
                    aria-current={childActive ? "page" : undefined}
                    className={[
                      "shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors duration-150",
                      childActive
                        ? "bg-peri-soft font-medium text-peri-deep"
                        : "text-muted hover:bg-bg",
                    ].join(" ")}
                  >
                    ↳ {child.name}
                  </Link>
                );
              })}
          </Fragment>
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
