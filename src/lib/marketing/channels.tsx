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
    status: "soon",
    icon: (
      <svg {...p} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5v.01" />
      </svg>
    ),
  },
  {
    key: "tiktok",
    name: "TikTok",
    status: "soon",
    icon: (
      <svg {...p} aria-hidden="true">
        <path d="M10 9a4 4 0 1 0 4 4V4c.5 2 2 3.5 4 3.8" />
      </svg>
    ),
  },
  {
    key: "youtube",
    name: "YouTube",
    status: "soon",
    icon: (
      <svg {...p} aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="m11 9 4 3-4 3V9Z" />
      </svg>
    ),
  },
  {
    key: "website",
    name: "Website",
    status: "soon",
    icon: (
      <svg {...p} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
      </svg>
    ),
  },
];
