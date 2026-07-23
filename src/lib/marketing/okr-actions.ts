"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditModule } from "@/lib/auth/guard";
import { DEFAULT_OKRS, withDefaults, type Okrs } from "@/lib/marketing/okr";

/* The single shared OKR set (one row, id = 'okr'). Editable defaults: if nothing
   is stored yet, the sensible defaults are returned so the UI always has targets. */

export async function getOkrs(): Promise<Okrs> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("marketing_okrs").select("data").eq("id", "okr").maybeSingle();
    const stored = (data as { data?: Partial<Okrs> } | null)?.data ?? null;
    return withDefaults(stored);
  } catch {
    return DEFAULT_OKRS;
  }
}

export async function saveOkrs(okrs: Okrs): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!(await canEditModule("marketing"))) return { ok: false };
  const { error } = await supabase.from("marketing_okrs").upsert(
    { id: "okr", data: okrs, updated_at: new Date().toISOString(), updated_by: user.id },
    { onConflict: "id" },
  );
  revalidatePath("/dashboard/marketing");
  revalidatePath("/dashboard/marketing/plan");
  return { ok: !error };
}
