import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* Server-only Supabase client using the SERVICE ROLE key.

   This bypasses row-level security, so it must NEVER be imported into a
   browser/client component. It exists for two trusted cases:
     1. The notification service writing a notification row for *another* user
        (RLS only lets a user insert their own rows).
     2. The scheduled reminders cron, which has no signed-in session and must
        read every team member's tasks.

   If the key isn't configured yet, returns null so callers can no-op
   gracefully (the rest of the app keeps working before setup). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
