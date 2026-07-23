import { guardModule } from "@/lib/auth/guard";

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  await guardModule("calendar");
  return <>{children}</>;
}
