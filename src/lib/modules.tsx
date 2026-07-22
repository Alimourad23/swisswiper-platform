import type { ReactNode } from "react";

const iconProps = {
  width: 19,
  height: 19,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Minimal monoline icons — calm, uncluttered, inherit currentColor. */
export const icons: Record<string, ReactNode> = {
  overview: (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  emails: (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  calendar: (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  ),
  marketing: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  sales: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M21 7v5M21 7h-5" />
    </svg>
  ),
  orders: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 6h18l-1.5 9a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 6Z" />
      <path d="M3 6 2 3M9 20.5h.01M16 20.5h.01" />
    </svg>
  ),
  finance: (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11" />
    </svg>
  ),
  tasks: (
    <svg {...iconProps} aria-hidden="true">
      <path d="m3.5 6 1.8 1.8L8.5 4.5M3.5 13l1.8 1.8 3.2-3.3M3.5 20l1.8 1.8 3.2-3.3M12.5 6.5h8M12.5 13.5h8M12.5 20.5h8" />
    </svg>
  ),
};

export type ModuleDef = {
  slug: string;
  name: string;
  subtitle: string;
  icon: ReactNode;
  status: "live" | "soon";
  /** For "live" modules: which external service powers it (shown as a badge). */
  service?: string;
};

/* Modules that have their own page under /dashboard. */
export const modules: ModuleDef[] = [
  {
    slug: "emails",
    name: "Emails",
    subtitle: "Your triaged inbox at a glance.",
    icon: icons.emails,
    status: "live",
    service: "Gmail",
  },
  {
    slug: "calendar",
    name: "Calendar",
    subtitle: "Today's agenda and your meeting load.",
    icon: icons.calendar,
    status: "live",
    service: "Google Calendar",
  },
  {
    slug: "tasks",
    name: "Tasks",
    subtitle: "A shared to-do list for the team.",
    icon: icons.tasks,
    status: "live",
  },
  {
    slug: "marketing",
    name: "Marketing",
    subtitle: "LinkedIn and Instagram performance.",
    icon: icons.marketing,
    status: "live",
  },
  {
    slug: "sales",
    name: "Sales",
    subtitle: "Pipeline and conversion.",
    icon: icons.sales,
    status: "soon",
  },
  {
    slug: "orders",
    name: "Orders",
    subtitle: "Order-to-delivery status.",
    icon: icons.orders,
    status: "soon",
  },
];

export function getModule(slug: string): ModuleDef | undefined {
  return modules.find((m) => m.slug === slug);
}

/* ---- Sidebar navigation model --------------------------------------- */

export type NavChild = { name: string; href: string; external?: boolean };
export type NavGroup = { label?: string; items: NavChild[] };

export type NavItem = {
  name: string;
  href?: string; // present only when clickable
  icon?: ReactNode;
  live?: boolean; // shows a green "Live" pill
  /** Flat nested items, revealed only while inside the parent's section. */
  children?: NavChild[];
  /** Labelled sub-sections (e.g. Marketing → Channels / Planning / …). When a
      module is active, its groups replace the flat list so every module reads
      the same way: the module at top, then its own breakdown. */
  groups?: NavGroup[];
};

export const founderNav: NavItem[] = [
  { name: "Overview", href: "/dashboard/overview", icon: icons.overview },
  { name: "Emails", href: "/dashboard/emails", icon: icons.emails, live: true },
  { name: "Calendar", href: "/dashboard/calendar", icon: icons.calendar, live: true },
  {
    name: "Tasks",
    href: "/dashboard/tasks",
    icon: icons.tasks,
    live: true,
    children: [
      { name: "My tasks", href: "/dashboard/tasks?view=mine" },
      { name: "Team board", href: "/dashboard/tasks?view=board" },
    ],
  },
  {
    name: "Marketing",
    href: "/dashboard/marketing",
    icon: icons.marketing,
    live: true,
    groups: [
      { items: [{ name: "Executive summary", href: "/dashboard/marketing" }] },
      {
        label: "Channels",
        items: [
          { name: "LinkedIn", href: "/dashboard/marketing/linkedin" },
          { name: "Instagram", href: "/dashboard/marketing/instagram" },
          { name: "Website", href: "/dashboard/marketing/website" },
        ],
      },
      {
        label: "Planning",
        items: [
          { name: "Plan", href: "/dashboard/marketing/plan" },
          { name: "Pipeline", href: "/dashboard/marketing/pipeline" },
          { name: "Content calendar", href: "/dashboard/marketing/calendar" },
        ],
      },
      {
        label: "Conversations",
        items: [{ name: "Engagement inbox", href: "/dashboard/marketing/engagement" }],
      },
    ],
  },
];

/* When you open a channel, its full set of sections appears in the sidebar,
   each a dedicated page. Keyed by the channel's base path. Sections without
   live data yet render an honest placeholder page (never fabricated numbers). */
export type SectionKey =
  | "overview" | "content" | "analytics" | "audience" | "engagement"
  | "stories" | "reels" | "hashtags" | "competitors" | "campaigns" | "reports";

const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "Overview", content: "Content", analytics: "Analytics", audience: "Audience",
  engagement: "Engagement", stories: "Stories", reels: "Reels", hashtags: "Hashtags",
  competitors: "Competitors", campaigns: "Campaigns", reports: "Reports",
};

/* Sections are channel-appropriate — only what's relevant to each medium.
   Stories/Reels/Hashtags are Instagram-only; they never appear on LinkedIn. */
export const CHANNEL_SECTION_KEYS: Record<string, SectionKey[]> = {
  linkedin: ["overview", "content", "analytics", "audience", "engagement", "competitors", "campaigns", "reports"],
  instagram: ["overview", "content", "analytics", "audience", "engagement", "stories", "reels", "hashtags", "competitors", "campaigns", "reports"],
};

function sectionsFor(channel: string): NavChild[] {
  const base = `/dashboard/marketing/${channel}`;
  return (CHANNEL_SECTION_KEYS[channel] ?? []).map((k) => ({
    name: SECTION_LABELS[k],
    href: k === "overview" ? base : `${base}/${k}`,
  }));
}

export const channelSections: Record<string, NavChild[]> = {
  "/dashboard/marketing/linkedin": sectionsFor("linkedin"),
  "/dashboard/marketing/instagram": sectionsFor("instagram"),
};
