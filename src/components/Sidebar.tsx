"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { founderNav, channelSections, type NavItem } from "@/lib/modules";
import { LivePill } from "@/components/Pill";
import { LinkedInLogo, InstagramLogo } from "@/components/marketing/logos";

function childLogo(href: string) {
  if (href === "/dashboard/marketing/linkedin") return <LinkedInLogo size={14} />;
  if (href === "/dashboard/marketing/instagram") return <InstagramLogo size={14} />;
  return null;
}

/* The sidebar reads the same way for every module: the module sits at the top,
   its own breakdown beneath it, and the other modules step back into a compact
   cluster. Overview is home — nothing expanded, all functions in view. A
   collapse control hides it down to an icon rail (remembered across visits). */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-hint">
      {children}
    </p>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-hint">
      {children}
    </p>
  );
}

const chevron = (dir: "left" | "right") => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
  </svg>
);
const extIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("sw-sidebar") === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sw-sidebar", next ? "1" : "0");
      } catch {}
      return next;
    });

  const isTopActive = (item: NavItem) =>
    !!item.href &&
    (item.href === "/dashboard/overview"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/"));

  // The module we're currently inside (has its own sub-nav). Overview has none,
  // so on Overview nothing collapses — every function stays in view.
  const activeModule = founderNav.find((it) => isTopActive(it) && (it.groups || it.children));
  const inModule = !!activeModule;

  /* ---------------- collapsed: slim icon rail ---------------- */
  if (collapsed) {
    return (
      <aside className="hidden w-[60px] shrink-0 flex-col items-center border-r border-hairline bg-surface py-4 md:flex">
        <button
          onClick={toggle}
          aria-label="Expand sidebar"
          title="Expand"
          className="mb-3 grid h-8 w-8 place-items-center rounded-[var(--radius-control)] text-hint hover:bg-bg hover:text-ink"
        >
          {chevron("right")}
        </button>
        <nav className="flex flex-col items-center gap-1.5">
          {founderNav.map((item) => {
            const active = isTopActive(item);
            return (
              <Link
                key={item.name}
                href={item.href!}
                title={item.name}
                aria-label={item.name}
                aria-current={active ? "page" : undefined}
                className={[
                  "grid h-9 w-9 place-items-center rounded-[var(--radius-control)] transition-colors",
                  active ? "bg-peri-soft text-peri-deep" : "text-muted hover:bg-bg hover:text-ink",
                ].join(" ")}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  /* ---------------- expanded ---------------- */
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-surface md:flex">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <span className="px-1 text-[15px] font-bold tracking-tight">SwissWiper</span>
        <button
          onClick={toggle}
          aria-label="Collapse sidebar"
          title="Collapse"
          className="grid h-7 w-7 place-items-center rounded-[var(--radius-control)] text-hint hover:bg-bg hover:text-ink"
        >
          {chevron("left")}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 pt-3">
        <div>
          <SectionLabel>Founder view</SectionLabel>
          <div className="flex flex-col gap-1">
            {founderNav.map((item) => {
              const active = isTopActive(item);
              const isActiveModule = activeModule?.name === item.name;
              // A non-active module, while we're inside another module → compact.
              const compact = inModule && !isActiveModule;

              return (
                <div key={item.name} className="flex flex-col gap-1">
                  <Link
                    href={item.href!}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-[var(--radius-control)] transition-colors duration-150",
                      compact ? "px-3 py-1.5 text-[12.5px]" : "px-3 py-2.5 text-sm",
                      active
                        ? "bg-peri-soft font-medium text-peri-deep"
                        : compact
                          ? "text-hint hover:bg-bg hover:text-ink"
                          : "text-muted hover:bg-bg hover:text-ink",
                    ].join(" ")}
                  >
                    <span className={["shrink-0", compact ? "opacity-70" : ""].join(" ")}>{item.icon}</span>
                    <span className="flex-1">{item.name}</span>
                    {item.live && !compact && <LivePill />}
                  </Link>

                  {/* the active module's own breakdown */}
                  {isActiveModule && item.groups && (
                    <div className="mb-1 flex flex-col">
                      {item.groups.map((g, gi) => (
                        <div key={gi} className="flex flex-col">
                          {g.label && <GroupLabel>{g.label}</GroupLabel>}
                          {g.items.map((child) => {
                            const sections = channelSections[child.href];
                            const onChannel = pathname === child.href;
                            return (
                              <div key={child.name} className="flex flex-col">
                                <ChildLink child={child} pathname={pathname} />
                                {/* when you're on this channel, its own sections appear */}
                                {sections && onChannel && (
                                  <div className="mb-1 ml-6 flex flex-col border-l border-hairline pl-2">
                                    {sections.map((sec) => (
                                      <a
                                        key={sec.name}
                                        href={sec.href}
                                        className="rounded-[var(--radius-control)] px-3 py-1 text-[12.5px] text-muted transition-colors hover:bg-bg hover:text-ink"
                                      >
                                        {sec.name}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {isActiveModule && !item.groups && item.children && (
                    <div className="mb-1 flex flex-col gap-1">
                      {item.children.map((child) => (
                        <ChildLink key={child.name} child={child} pathname={pathname} flat />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </nav>
    </aside>
  );
}

function ChildLink({
  child,
  pathname,
  flat,
}: {
  child: { name: string; href: string; external?: boolean };
  pathname: string;
  flat?: boolean;
}) {
  const pad = flat ? "pl-9 pr-3" : "px-3 ml-3";
  if (child.external) {
    return (
      <a
        href={child.href}
        target="_blank"
        rel="noopener"
        className={`flex items-center gap-1.5 rounded-[var(--radius-control)] ${pad} py-1.5 text-[13px] text-muted transition-colors duration-150 hover:bg-bg hover:text-ink`}
      >
        <span className="flex-1">{child.name}</span>
        <span className="text-peri-deep">{extIcon}</span>
      </a>
    );
  }
  const active = pathname === child.href;
  const logo = childLogo(child.href);
  return (
    <Link
      href={child.href}
      aria-current={active ? "page" : undefined}
      className={[
        `flex items-center gap-2 rounded-[var(--radius-control)] ${pad} py-1.5 text-[13px] transition-colors duration-150`,
        active ? "bg-peri-soft font-medium text-peri-deep" : "text-muted hover:bg-bg hover:text-ink",
      ].join(" ")}
    >
      {logo}
      <span>{child.name}</span>
    </Link>
  );
}
