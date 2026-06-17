import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";

export default async function TopBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.full_name ?? meta.name ?? user?.email ?? "";
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null;

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <Link href="/dashboard" className="text-lg font-medium tracking-tight text-ink">
        SwissWiper
      </Link>

      <UserMenu name={name} avatarUrl={avatarUrl} />
    </header>
  );
}
