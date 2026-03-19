import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdminSessionOrRedirect } from "@/lib/server/admin/guards";

const items = [
  { href: "/app/admin", label: "Overview" },
  { href: "/app/admin/jobs", label: "Jobs" },
  { href: "/app/admin/webhooks", label: "Webhooks" },
  { href: "/app/admin/exports", label: "Exports" },
  { href: "/app/admin/health", label: "Health" },
  { href: "/app/admin/maintenance", label: "Maintenance" },
  { href: "/app/admin/accounts", label: "Accounts" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminSessionOrRedirect();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-sm border border-border-subtle bg-surface-white p-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-sm border border-border-subtle px-3 py-1 text-xs text-text-graphite hover:bg-surface-panel">
            {item.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
