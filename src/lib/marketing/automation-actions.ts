"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_POLICY, normalizePolicy, type AutomationPolicy } from "@/lib/marketing/automation";

/* The single shared automation policy (one row, id = 'policy'). Defaults to
   everything approval-first; only auto-eligible categories can be set to auto. */

export async function getAutomationPolicy(): Promise<AutomationPolicy> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("marketing_automation").select("data").eq("id", "policy").maybeSingle();
    return normalizePolicy((data as { data?: Partial<AutomationPolicy> } | null)?.data ?? null);
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function saveAutomationPolicy(policy: AutomationPolicy): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  // Re-normalize server-side so locked categories can never be forced to auto.
  const safe = normalizePolicy(policy);
  const { error } = await supabase.from("marketing_automation").upsert(
    { id: "policy", data: safe, updated_at: new Date().toISOString(), updated_by: user.id },
    { onConflict: "id" },
  );
  revalidatePath("/dashboard/marketing/engagement");
  return { ok: !error };
}
