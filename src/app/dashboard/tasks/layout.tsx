import { guardModule } from "@/lib/auth/guard";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  await guardModule("tasks");
  return <>{children}</>;
}
