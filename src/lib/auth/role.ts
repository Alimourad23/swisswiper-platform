import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Is the signed-in user a founder? (profiles.role) */
export async function getIsFounder(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return (data as { role?: string } | null)?.role === "founder";
}
