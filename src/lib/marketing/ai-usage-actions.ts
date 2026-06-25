"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsage, type UsageSummary } from "@/lib/marketing/ai-usage";

export type UsageView = UsageSummary & { isFounder: boolean };

export async function getUsageSummary(): Promise<UsageView> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const usage = await getUsage();
  let isFounder = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isFounder = (data as { role?: string } | null)?.role === "founder";
  }
  return { ...usage, isFounder };
}

/* Founders only (enforced by RLS too). Sets the monthly AI spend cap. */
export async function setBudget(cap: number): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const value = Math.max(0, Math.round(cap));
  const { error } = await supabase
    .from("ai_budget")
    .update({ monthly_cap_usd: value, updated_at: new Date().toISOString() })
    .eq("id", "budget");
  revalidatePath("/dashboard/marketing");
  return { ok: !error };
}
