"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildMonthSuggestions } from "@/lib/marketing/monthly-generate";
import { dateForDay, monthKey as nextMonthKey, type MonthPlan, type MonthSuggestion } from "@/lib/marketing/monthly";

async function uid() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, id: user.id } : null;
}

/* The plan for a given month (defaults to next month), whatever its status. */
export async function getMonthPlan(month?: string): Promise<MonthPlan | null> {
  const c = await uid();
  if (!c) return null;
  const key = month ?? nextMonthKey();
  const { data } = await c.supabase.from("marketing_month_plans").select("*").eq("month", key).maybeSingle();
  return (data as MonthPlan | null) ?? null;
}

/* Generate (or regenerate) Alfred's suggestions for a month and store them. */
export async function generateMonthPlanNow(month?: string): Promise<MonthPlan | null> {
  const c = await uid();
  if (!c) return null;
  const key = month ?? nextMonthKey();

  const [{ data: planRow }, { data: postRows }] = await Promise.all([
    c.supabase.from("marketing_plan").select("*").limit(1).maybeSingle(),
    c.supabase
      .from("content_posts")
      .select("title, channel, scheduled_for, status")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const suggestions = await buildMonthSuggestions({
    monthKey: key,
    plan: (planRow as Record<string, string> | null) ?? {},
    recentPosts: (postRows as { title: string; channel: string; scheduled_for: string | null; status: string }[]) ?? [],
  });
  if (suggestions.length === 0) return null;

  const { data } = await c.supabase
    .from("marketing_month_plans")
    .upsert(
      { month: key, status: "suggested", suggestions, created_by: c.id, updated_at: new Date().toISOString() },
      { onConflict: "month" },
    )
    .select("*")
    .single();
  revalidatePath("/dashboard/marketing/pipeline");
  return (data as MonthPlan | null) ?? null;
}

/* Add a month's suggestions to the pipeline as scheduled posts, then mark applied. */
export async function applyMonthPlan(month: string): Promise<{ ok: boolean; added: number }> {
  const c = await uid();
  if (!c) return { ok: false, added: 0 };

  const { data: plan } = await c.supabase.from("marketing_month_plans").select("*").eq("month", month).maybeSingle();
  const row = plan as MonthPlan | null;
  if (!row || row.status === "applied") return { ok: false, added: 0 };

  const rows = (row.suggestions as MonthSuggestion[]).map((s) => ({
    created_by: c.id,
    title: s.title,
    channel: s.channel,
    status: "scheduled",
    scheduled_for: dateForDay(month, s.day),
    body: "",
    notes: s.idea ? `Alfred idea: ${s.idea}` : "",
  }));
  if (rows.length) await c.supabase.from("content_posts").insert(rows);

  await c.supabase
    .from("marketing_month_plans")
    .update({ status: "applied", updated_at: new Date().toISOString() })
    .eq("month", month);

  revalidatePath("/dashboard/marketing/pipeline");
  revalidatePath("/dashboard/marketing/calendar");
  return { ok: true, added: rows.length };
}

export async function dismissMonthPlan(month: string): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  const { error } = await c.supabase
    .from("marketing_month_plans")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("month", month);
  revalidatePath("/dashboard/marketing/pipeline");
  return { ok: !error };
}
