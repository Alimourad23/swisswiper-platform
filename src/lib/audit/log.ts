import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Record a change to the audit log — who did what, in which module, to which
   thing, and (where it matters) before → after. Best-effort: never throws, so a
   logging hiccup can't break the action it's recording. Uses the signed-in
   user's own session (RLS lets a user insert their own audit rows). */

export async function logChange(input: {
  action: string;
  module?: string;
  target?: string | null;
  before?: string | null;
  after?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    const name = (data as { full_name?: string } | null)?.full_name || meta.full_name || meta.name || user.email || "Someone";

    await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_name: name,
      action: input.action,
      module: input.module ?? null,
      target: input.target ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    });
  } catch {
    /* logging is best-effort */
  }
}
