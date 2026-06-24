/* The living marketing plan — type + field metadata (importable by client
   components). Server actions live in `plan-actions.ts`. */

export type MarketingPlan = {
  goals: string;
  audience: string;
  positioning: string;
  pillars: string;
  cadence: string;
  budget: string;
};

export const EMPTY_PLAN: MarketingPlan = {
  goals: "",
  audience: "",
  positioning: "",
  pillars: "",
  cadence: "",
  budget: "",
};

export const PLAN_FIELDS: { key: keyof MarketingPlan; label: string; placeholder: string }[] = [
  { key: "goals", label: "Goals", placeholder: "What are we trying to achieve this quarter? (e.g. 1,000 followers, 20 hotel inquiries)" },
  { key: "audience", label: "Audience / ICP", placeholder: "Who are we reaching? (e.g. luxury hotel GMs & procurement; design-led homeowners)" },
  { key: "positioning", label: "Positioning", placeholder: "The one message. (e.g. spotless glass, effortlessly — luxury hard-water care)" },
  { key: "pillars", label: "Content pillars", placeholder: "The recurring themes. (e.g. the problem, the craft, proof, behind-the-scenes)" },
  { key: "cadence", label: "Channel mix & cadence", placeholder: "Where and how often. (e.g. LinkedIn 3×/week, Instagram 2×/week)" },
  { key: "budget", label: "Budget", placeholder: "Monthly spend & where it goes." },
];
