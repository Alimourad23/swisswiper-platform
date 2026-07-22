/* Automation graduation policy — per category, whether Alfred's reply stays
   approval-first or graduates to auto-send. The sensitive categories are LOCKED
   to approval-first by design (brand voice + EU AI Act caution): only light,
   safe categories can ever be set to auto. Types + defaults; pure. */

export type CatKey =
  | "compliment" | "product_question" | "price_question"
  | "complaint" | "collaboration" | "spam" | "other";

export type Policy = "approve" | "auto";

export type CategoryDef = {
  key: CatKey;
  label: string;
  /** Who normally answers it (for context in the UI). */
  voice: "Ali" | "Etienne" | "—";
  /** Only auto-eligible categories can be switched to auto; the rest are locked. */
  autoEligible: boolean;
  note: string;
};

export const CATEGORIES: CategoryDef[] = [
  { key: "compliment", label: "Compliments & thanks", voice: "Ali", autoEligible: true, note: "A warm one-line thank-you — safe to automate." },
  { key: "spam", label: "Spam", voice: "—", autoEligible: true, note: "Left unanswered automatically." },
  { key: "product_question", label: "Product questions", voice: "Etienne", autoEligible: false, note: "Answered by Etienne — always your review." },
  { key: "price_question", label: "Price & commissions", voice: "Ali", autoEligible: false, note: "Sensitive — never automated." },
  { key: "complaint", label: "Complaints", voice: "Ali", autoEligible: false, note: "Handled personally, always." },
  { key: "collaboration", label: "Collaborations", voice: "Ali", autoEligible: false, note: "A founder decision — approval-first." },
  { key: "other", label: "Everything else", voice: "Ali", autoEligible: false, note: "Approval-first by default." },
];

export type AutomationPolicy = Record<CatKey, Policy>;

export const DEFAULT_POLICY: AutomationPolicy = {
  compliment: "approve", spam: "approve", product_question: "approve",
  price_question: "approve", complaint: "approve", collaboration: "approve", other: "approve",
};

/** Merge stored policy over defaults, and FORCE non-eligible categories to
    "approve" no matter what was stored — the lock can't be bypassed. */
export function normalizePolicy(stored: Partial<AutomationPolicy> | null | undefined): AutomationPolicy {
  const out = { ...DEFAULT_POLICY };
  const eligible = new Set(CATEGORIES.filter((c) => c.autoEligible).map((c) => c.key));
  for (const c of CATEGORIES) {
    const v = stored?.[c.key];
    out[c.key] = v === "auto" && eligible.has(c.key) ? "auto" : "approve";
  }
  return out;
}

export function autoCount(policy: AutomationPolicy): number {
  return CATEGORIES.filter((c) => policy[c.key] === "auto").length;
}
