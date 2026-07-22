/* Marketing OKRs — a general objective with company-level key results, and
   per-channel KPIs that roll up into it. Types + sensible defaults + a progress
   helper. Pure and client-importable; server actions live in okr-actions.ts. */

export type Kr = {
  key: string;
  label: string;
  target: number;
  /** "%" for rates, "/mo" for cadence, undefined for plain counts. */
  unit?: string;
};

export type Okrs = {
  objective: string;
  company: Kr[];
  linkedin: Kr[];
  instagram: Kr[];
  website: Kr[];
};

export const DEFAULT_OKRS: Okrs = {
  objective: "Build qualified pipeline through founder-led content",
  company: [
    { key: "followers", label: "Total followers", target: 1000 },
    { key: "reach", label: "Monthly reach", target: 5000 },
    { key: "inquiries", label: "Inquiries", target: 20 },
  ],
  linkedin: [
    { key: "followers", label: "Followers", target: 600 },
    { key: "engagement", label: "Engagement rate", target: 8, unit: "%" },
    { key: "posts", label: "Posts", target: 12, unit: "/mo" },
  ],
  instagram: [
    { key: "followers", label: "Followers", target: 400 },
    { key: "reach", label: "28-day reach", target: 2000 },
    { key: "posts", label: "Posts", target: 16, unit: "/mo" },
  ],
  website: [
    { key: "visits", label: "Monthly visits", target: 1500 },
    { key: "inquiries", label: "Inquiries from site", target: 15 },
  ],
};

/** Merge a stored (partial) OKR object over the defaults so the shape is always complete. */
export function withDefaults(stored: Partial<Okrs> | null | undefined): Okrs {
  if (!stored) return DEFAULT_OKRS;
  return {
    objective: stored.objective ?? DEFAULT_OKRS.objective,
    company: stored.company?.length ? stored.company : DEFAULT_OKRS.company,
    linkedin: stored.linkedin?.length ? stored.linkedin : DEFAULT_OKRS.linkedin,
    instagram: stored.instagram?.length ? stored.instagram : DEFAULT_OKRS.instagram,
    website: stored.website?.length ? stored.website : DEFAULT_OKRS.website,
  };
}

export type Objective = { label: string; actual: number; target: number; unit?: string };

/** Fraction complete, clamped to [0,1]. */
export function progress(actual: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(1, actual / target)) : 0;
}

/** Turn a channel's KRs + an actuals lookup into displayable objectives. */
export function objectivesFrom(krs: Kr[], actuals: Record<string, number>): Objective[] {
  return krs.map((kr) => ({ label: kr.label, target: kr.target, unit: kr.unit, actual: actuals[kr.key] ?? 0 }));
}
