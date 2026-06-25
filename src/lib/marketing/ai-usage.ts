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
};

export async function getUsage(): Promise<UsageSummary> {
  const supabase = await createClient();
  const [{ data: rows }, { data: budget }] = await Promise.all([
    supabase.from("ai_usage").select("kind, units, cost_usd").gte("created_at", monthStart()),
    supabase.from("ai_budget").select("monthly_cap_usd").eq("id", "budget").maybeSingle(),
  ]);
  let spend = 0;
  let images = 0;
  let videoSeconds = 0;
  for (const r of (rows ?? []) as { kind: string; units: number; cost_usd: number }[]) {
    spend += Number(r.cost_usd) || 0;
    if (r.kind === "image") images += Number(r.units) || 0;
    if (r.kind === "video") videoSeconds += Number(r.units) || 0;
  }
  const cap = Number((budget as { monthly_cap_usd?: number } | null)?.monthly_cap_usd ?? 50);
  return { spend: Math.round(spend * 100) / 100, cap, images, videoSeconds };
}

/* Is there budget for an estimated additional cost? */
export async function budgetCheck(estCost: number): Promise<{ ok: boolean; spend: number; cap: number }> {
  const u = await getUsage();
  return { ok: u.spend + estCost <= u.cap, spend: u.spend, cap: u.cap };
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
