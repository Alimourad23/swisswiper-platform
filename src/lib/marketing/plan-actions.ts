"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditModule } from "@/lib/auth/guard";
import { EMPTY_PLAN, type MarketingPlan } from "@/lib/marketing/plan";

/* The single shared marketing plan (one row, id = 'plan'). */

export async function getPlan(): Promise<MarketingPlan> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_PLAN;
  const { data } = await supabase
    .from("marketing_plan")
    .select("goals, audience, positioning, pillars, cadence, budget")
    .eq("id", "plan")
    .maybeSingle();
  return { ...EMPTY_PLAN, ...((data as Partial<MarketingPlan> | null) ?? {}) };
}

export async function savePlan(plan: MarketingPlan): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const { error } = await supabase.from("marketing_plan").upsert(
    {
      id: "plan",
      goals: plan.goals,
      audience: plan.audience,
      positioning: plan.positioning,
      pillars: plan.pillars,
      cadence: plan.cadence,
      budget: plan.budget,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "id" },
  );
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}
