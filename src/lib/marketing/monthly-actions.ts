"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildMonthSuggestions } from "@/lib/marketing/monthly-generate";
import { createPostsBulk } from "@/lib/marketing/schedule-actions";
import { assignOpenDates, recommendedCount, CADENCE } from "@/lib/marketing/cadence";
import { floorForMonth, monthKey as nextMonthKey, type MonthPlan, type MonthSuggestion } from "@/lib/marketing/monthly";

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
  const thisMonth = (thisRows as CtxPost[]) ?? [];
  // Per-channel counts + the dates already taken (so we never double-book).
  const plannedByChannel: Record<string, number> = {};
  const takenByChannel: Record<string, string[]> = {};
  for (const p of thisMonth) {
    plannedByChannel[p.channel] = (plannedByChannel[p.channel] ?? 0) + 1;
    if (p.scheduled_for) (takenByChannel[p.channel] ??= []).push(p.scheduled_for);
  }
  return {
    plan: (planRow as Record<string, string> | null) ?? {},
    recent: (recentRows as CtxPost[]) ?? [],
    thisMonth,
    plannedByChannel,
    takenByChannel,
  };
}

// Gap to the recommended monthly volume, per channel.
function gapByChannel(planned: Record<string, number>): Record<string, number> {
  const need: Record<string, number> = {};
  for (const ch of Object.keys(CADENCE)) {
    const g = recommendedCount(ch) - (planned[ch] ?? 0);
    if (g > 0) need[ch] = g;
  }
  return need;
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

  const raw = await buildMonthSuggestions({
    monthKey: key,
    plan: ctx.plan,
    recentPosts: ctx.recent,
    thisMonthPosts: ctx.thisMonth,
    count,
    need: gapByChannel(ctx.plannedByChannel),
  });
  if (raw.length === 0) return null;

  // Engine assigns real open dates: on-cadence, on/after today, skipping taken days.
  const dates = assignOpenDates(key, raw, { floor: floorForMonth(key), takenByChannel: ctx.takenByChannel });
  const suggestions: MonthSuggestion[] = raw.map((s, i) => ({ ...s, date: dates[i] }));

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
    ...existingSugg.map((s) => ({ title: s.title, channel: s.channel, scheduled_for: s.date ?? null, status: "suggested" })),
  ];
  // Count existing suggestions toward the planned tally so we only fill what's left.
  const plannedPlusSugg = { ...ctx.plannedByChannel };
  for (const s of existingSugg) plannedPlusSugg[s.channel] = (plannedPlusSugg[s.channel] ?? 0) + 1;

  const raw = await buildMonthSuggestions({
    monthKey: month,
    plan: ctx.plan,
    recentPosts: ctx.recent,
    thisMonthPosts: dedupContext,
    count,
    need: gapByChannel(plannedPlusSugg),
  });

  // Open dates, treating existing suggestion dates (and posts) as taken.
  const takenPlus = { ...ctx.takenByChannel } as Record<string, string[]>;
  for (const s of existingSugg) if (s.date) (takenPlus[s.channel] ??= []).push(s.date);
  const dates = assignOpenDates(month, raw, { floor: floorForMonth(month), takenByChannel: takenPlus });
  const more: MonthSuggestion[] = raw.map((s, i) => ({ ...s, date: dates[i] }));
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
