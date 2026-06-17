import { createClient } from "@/lib/supabase/server";
import type { LinkedInMetrics } from "@/lib/linkedin/parse";
import seed from "@/lib/linkedin/seed-data.json";

export type LinkedInResult = {
  metrics: LinkedInMetrics;
  source: "db" | "seed";
  capturedAt: string;
};

/* Reads the latest uploaded LinkedIn snapshot from Supabase; falls back to the
   bundled seed (parsed from the first export) so real numbers show immediately. */
export async function getLinkedInMetrics(): Promise<LinkedInResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("linkedin_metrics")
        .select("data, captured_at")
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as { data?: LinkedInMetrics; captured_at?: string } | null;
      if (row?.data) {
        return { metrics: row.data, source: "db", capturedAt: row.captured_at ?? row.data.generatedAt };
      }
    }
  } catch {
    // fall through to seed
  }
  const s = seed as LinkedInMetrics;
  return { metrics: s, source: "seed", capturedAt: s.generatedAt };
}
