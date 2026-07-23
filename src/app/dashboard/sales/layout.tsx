import { guardModule } from "@/lib/auth/guard";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await guardModule("sales");
  return <>{children}</>;
}
