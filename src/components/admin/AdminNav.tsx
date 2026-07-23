import Link from "next/link";

/* Tabs within the admin panel. Kept in one place so pages stay in sync. */
const TABS = [
  { key: "people", label: "People", href: "/dashboard/admin" },
  { key: "access", label: "Access", href: "/dashboard/admin/access" },
  { key: "audit", label: "Audit log", href: "/dashboard/admin/audit" },
];

export default function AdminNav({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            active === t.key ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
