"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* The per-user daily plan: which tasks you've committed to today, and your time
   estimate for each. "Today" is the caller's LOCAL date (YYYY-MM-DD), passed in
   so it follows the device timezone. All rows are owned by the signed-in user
   (RLS). */

export type PlanRow = { task_id: string; estimate_min: number; sort_order: number };

async function uid(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, id: user.id } : null;
}

export async function getTodayRows(planDate: string): Promise<PlanRow[]> {
  const c = await uid();
  if (!c) return [];
  const { data } = await c.supabase
    .from("daily_plan")
    .select("task_id, estimate_min, sort_order")
    .eq("user_id", c.id)
    .eq("plan_date", planDate)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PlanRow[];
}

export async function planToday(
  taskId: string,
  planDate: string,
  estimateMin = 30,
): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  const { error } = await c.supabase.from("daily_plan").upsert(
    { user_id: c.id, task_id: taskId, plan_date: planDate, estimate_min: estimateMin },
    { onConflict: "user_id,task_id,plan_date" },
  );
  revalidatePath("/dashboard/tasks");
  return { ok: !error };
}

export async function unplanToday(taskId: string, planDate: string): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  const { error } = await c.supabase
    .from("daily_plan")
    .delete()
    .eq("user_id", c.id)
    .eq("task_id", taskId)
    .eq("plan_date", planDate);
  revalidatePath("/dashboard/tasks");
  return { ok: !error };
}

export async function setEstimate(
  taskId: string,
  planDate: string,
  estimateMin: number,
): Promise<{ ok: boolean }> {
  const c = await uid();
  if (!c) return { ok: false };
  const { error } = await c.supabase
    .from("daily_plan")
    .update({ estimate_min: Math.max(5, estimateMin) })
    .eq("user_id", c.id)
    .eq("task_id", taskId)
    .eq("plan_date", planDate);
  return { ok: !error };
}
