import { guardModule } from "@/lib/auth/guard";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await guardModule("orders");
  return <>{children}</>;
}
