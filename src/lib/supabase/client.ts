import { createBrowserClient } from "@supabase/ssr";

/* Supabase client for use in the browser (Client Components).
   Uses the public URL + anon key, which are safe to expose. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
