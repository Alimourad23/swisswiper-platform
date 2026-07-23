import { guardModule } from "@/lib/auth/guard";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  await guardModule("marketing");
  return <>{children}</>;
}
