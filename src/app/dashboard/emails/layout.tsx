import { guardModule } from "@/lib/auth/guard";

export default async function EmailsLayout({ children }: { children: React.ReactNode }) {
  await guardModule("emails");
  return <>{children}</>;
}
