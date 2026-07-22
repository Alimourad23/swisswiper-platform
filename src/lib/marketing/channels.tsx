import type { ReactNode } from "react";

const p = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type Channel = {
  key: string;
  name: string;
  status: "live" | "soon";
  icon: ReactNode;
  /** External link (e.g. the live website) — makes the channel row clickable out. */
  href?: string;
};

export const channels: Channel[] = [
  {
    key: "linkedin",
    name: "LinkedIn",
    status: "live",
    icon: (
      <svg {...p} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7 10v6M7 7v.01M11 16v-3.5a1.5 1.5 0 0 1 3 0V16M11 16v-6" />
      </svg>
    ),
  },
  {
    key: "instagram",
    name: "Instagram",
    status: "live",
    icon: (
      <svg {...p} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5v.01" />
      </svg>
    ),
  },
  {
    key: "website",
    name: "Website",
    status: "soon",
    href: "https://swisswiper.com/",
    icon: (
      <svg {...p} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
      </svg>
    ),
  },
];
