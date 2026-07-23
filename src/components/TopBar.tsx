import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";
import NotificationBell, { type AppNotification } from "@/components/NotificationBell";

export default async function TopBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.full_name ?? meta.name ?? user?.email ?? "";
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null;

  // Recent notifications for the bell (RLS scopes these to the signed-in user).
  let notifications: AppNotification[] = [];
  let googleConnected = false;
  if (user) {
    const [{ data: notif }, { data: gtok }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, task_id, type, message, read, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      // A stored refresh-token row means Google is connected. Dead tokens now
      // clear themselves (see lib/google/tokens.ts), so a present row is a
      // reliable "connected" signal for the header.
      supabase.from("google_tokens").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    notifications = (notif ?? []) as AppNotification[];
    googleConnected = !!gtok;
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <Link href="/dashboard" className="text-lg font-medium tracking-tight text-ink">
        SwissWiper
      </Link>

      <div className="flex items-center gap-3">
        {user && <NotificationBell userId={user.id} initial={notifications} />}
        <UserMenu name={name} avatarUrl={avatarUrl} googleConnected={googleConnected} />
      </div>
    </header>
  );
}
