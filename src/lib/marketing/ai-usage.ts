import "server-only";
import { createClient } from "@/lib/supabase/server";

/* AI spend tracking + monthly cap. Rough cost estimates (USD) — labelled as
   estimates in the UI. Used to show usage and to block generation once the
   month's cap is hit. */

// Estimated cost per image by model + size.
export function imageCost(model: string, size: string): number {
  const pro = model === "pro";
  if (size === "4K") return pro ? 0.24 : 0.12;
  if (size === "2K") return pro ? 0.13 : 0.06;
  return pro ? 0.1 : 0.04; // 1K
}
// Estimated cost per second of Veo video (audio on).
export const VIDEO_PER_SEC = 0.4;
export function videoCost(seconds: number): number {
  return Math.round(seconds * VIDEO_PER_SEC * 100) / 100;
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export type UsageSummary = {
  spend: number; // this month, USD (estimated)
  cap: number; // monthly cap, USD
  images: number; // images generated this month
  videoSeconds: number; // seconds of video this month
  credit: number; // prepaid credit the founder bought (USD) — 0 = not tracked
  spentAllTime: number; // all-time estimated spend, USD
  remaining: number; // credit − spentAllTime (can be negative; clamp for display)
};

export async function getUsage(): Promise<UsageSummary> {
  const supabase = await createClient();
  const [{ data: rows }, { data: budget }] = await Promise.all([
    supabase.from("ai_usage").select("kind, units, cost_usd, created_at"),
    supabase.from("ai_budget").select("monthly_cap_usd, credit_usd").eq("id", "budget").maybeSingle(),
  ]);
  const start = monthStart();
  let spend = 0;
  let images = 0;
  let videoSeconds = 0;
  let spentAllTime = 0;
  for (const r of (rows ?? []) as { kind: string; units: number; cost_usd: number; created_at: string }[]) {
    const c = Number(r.cost_usd) || 0;
    spentAllTime += c;
    if (r.created_at >= start) {
      spend += c;
      if (r.kind === "image") images += Number(r.units) || 0;
      if (r.kind === "video") videoSeconds += Number(r.units) || 0;
    }
  }
  const b = budget as { monthly_cap_usd?: number; credit_usd?: number } | null;
  const cap = Number(b?.monthly_cap_usd ?? 50);
  const credit = Number(b?.credit_usd ?? 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    spend: r2(spend),
    cap,
    images,
    videoSeconds,
    credit: r2(credit),
    spentAllTime: r2(spentAllTime),
    remaining: r2(credit - spentAllTime),
  };
}

/* Is there budget for an estimated additional cost? Blocks when it would breach
   the monthly cap OR run past the prepaid credit (credit only enforced when set). */
export async function budgetCheck(
  estCost: number,
): Promise<{ ok: boolean; spend: number; cap: number; remaining: number }> {
  const u = await getUsage();
  const capOk = u.spend + estCost <= u.cap;
  const creditOk = u.credit <= 0 ? true : u.spentAllTime + estCost <= u.credit;
  return { ok: capOk && creditOk, spend: u.spend, cap: u.cap, remaining: u.remaining };
}

/* Record a generation's estimated cost. */
export async function logUsage(input: { kind: "image" | "video"; model?: string; units: number; cost: number }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("ai_usage").insert({
    user_id: user.id,
    kind: input.kind,
    model: input.model ?? null,
    units: input.units,
    cost_usd: input.cost,
  });
}
