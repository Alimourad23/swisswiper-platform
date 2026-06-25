"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildMonthSuggestions } from "@/lib/marketing/monthly-generate";
import { createPostsBulk } from "@/lib/marketing/schedule-actions";
import { monthKey as nextMonthKey, type MonthPlan, type MonthSuggestion } from "@/lib/marketing/monthly";

async function uid() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, id: user.id } : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function monthBounds(key: string) {
  const [y, m] = key.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { start: `${key}-01`, nextStart: `${next}-01` };
}

type CtxPost = { title: string; channel: string; scheduled_for: string | null; status: string };

async function loadContext(supabase: Awaited<ReturnType<typeof createClient>>, key: string) {
  const { start, nextStart } = monthBounds(key);
  const [{ data: planRow }, { data: recentRows }, { data: thisRows }] = await Promise.all([
    supabase.from("marketing_plan").select("*").limit(1).maybeSingle(),
    supabase
      .from("content_posts")
      .select("title, channel, scheduled_for, status")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("content_posts")
      .select("title, channel, scheduled_for, status")
      .gte("scheduled_for", start)
      .lt("scheduled_for", nextStart),
  ]);
  return {
    plan: (planRow as Record<string, string> | null) ?? {},
    recent: (recentRows as CtxPost[]) ?? [],
    thisMonth: (thisRows as CtxPost[]) ?? [],
  };
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
export async function generateMonthPlanNow(month?: string, count?: number): Promise<MonthPlan | null> {
  const c = await uid();
  if (!c) return null;
  const key = month ?? nextMonthKey();
  const ctx = await loadContext(c.supabase, key);

  const suggestions = await buildMonthSuggestions({
    monthKey: key,
    plan: ctx.plan,
    recentPosts: ctx.recent,
    thisMonthPosts: ctx.thisMonth,
    count,
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

/* Suggest MORE posts for a month, appended to the existing plan and de-duplicated
   against what's already planned/suggested. */
export async function suggestMoreMonthPlan(month: string, count = 5): Promise<MonthPlan | null> {
  const c = await uid();
  if (!c) return null;
  const ctx = await loadContext(c.supabase, month);

  const { data: existing } = await c.supabase
    .from("marketing_month_plans")
    .select("*")
    .eq("month", month)
    .maybeSingle();
  const existingSugg = ((existing as MonthPlan | null)?.suggestions ?? []) as MonthSuggestion[];

  const dedupContext: CtxPost[] = [
    ...ctx.thisMonth,
    ...existingSugg.map((s) => ({ title: s.title, channel: s.channel, scheduled_for: null, status: "suggested" })),
  ];
  const more = await buildMonthSuggestions({
    monthKey: month,
    plan: ctx.plan,
    recentPosts: ctx.recent,
    thisMonthPosts: dedupContext,
    count,
  });
  const merged = [...existingSugg, ...more];

  const { data } = await c.supabase
    .from("marketing_month_plans")
    .upsert(
      { month, status: "suggested", suggestions: merged, created_by: c.id, updated_at: new Date().toISOString() },
      { onConflict: "month" },
    )
    .select("*")
    .single();
  revalidatePath("/dashboard/marketing/pipeline");
  return (data as MonthPlan | null) ?? null;
}

/* Add a chosen subset (with possibly-edited dates) to the pipeline, then remove
   those from the plan's suggestions (so the rest remain for next time). */
export async function addPlanItems(
  month: string,
  items: { title: string; channel: string; idea?: string; goal?: string; date: string }[],
): Promise<{ ok: boolean; added: number }> {
  const c = await uid();
  if (!c || items.length === 0) return { ok: false, added: 0 };

  await createPostsBulk(
    items.map((it) => ({
      title: it.title,
      channel: it.channel,
      scheduledFor: it.date,
      seedIdea: it.idea,
      goal: it.goal,
      source: "alfred",
      notes: it.idea ? `Alfred idea: ${it.idea}` : "",
    })),
  );

  const { data: planRow } = await c.supabase
    .from("marketing_month_plans")
    .select("*")
    .eq("month", month)
    .maybeSingle();
  const row = planRow as MonthPlan | null;
  if (row) {
    const addedKeys = new Set(items.map((i) => `${i.channel}|${i.title}`));
    const remaining = (row.suggestions as MonthSuggestion[]).filter((s) => !addedKeys.has(`${s.channel}|${s.title}`));
    await c.supabase
      .from("marketing_month_plans")
      .update({
        suggestions: remaining,
        status: remaining.length ? "suggested" : "applied",
        updated_at: new Date().toISOString(),
      })
      .eq("month", month);
  }

  revalidatePath("/dashboard/marketing/pipeline");
  revalidatePath("/dashboard/marketing/calendar");
  return { ok: true, added: items.length };
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
