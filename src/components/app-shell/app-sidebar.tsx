"use client";

import Link from "next/link";
import { Lock, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analysisWorkflowItems, appSecondaryItems, type AppNavItem } from "@/lib/app/navigation";

function NavGroup({ title, items, onNavigate }: { title: string; items: AppNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-2">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between rounded-sm border border-transparent px-3 py-2 text-sm text-text-graphite transition-colors hover:bg-surface-panel",
                  active && "border-brand/20 bg-brand/5 text-text-institutional",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.locked ? <Lock className="h-3.5 w-3.5 text-text-neutral" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-[var(--z-sticky)] border-b bg-white p-3 lg:hidden">
        <button
          type="button"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle app navigation"
        >
          {open ? <X className="mr-2 h-4 w-4" /> : <Menu className="mr-2 h-4 w-4" />}
          Workspace Menu
        </button>
      </div>

      <aside className="hidden h-screen w-72 shrink-0 border-r bg-white lg:block lg:sticky lg:top-0">
        <div className="flex h-full flex-col px-4 py-5">
          <Link href="/app" className="mb-6 px-3 text-sm font-semibold tracking-wide">
            Strategy Robustness Lab
          </Link>
          <div className="space-y-6 overflow-y-auto">
            <NavGroup title="Validation Workflow" items={analysisWorkflowItems} />
            <NavGroup title="Workspace" items={appSecondaryItems} />
          </div>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-black/20 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-80 border-r bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <Link href="/app" className="mb-6 block px-3 text-sm font-semibold tracking-wide" onClick={() => setOpen(false)}>
              Strategy Robustness Lab
            </Link>
            <div className="space-y-6">
              <NavGroup title="Validation Workflow" items={analysisWorkflowItems} onNavigate={() => setOpen(false)} />
              <NavGroup title="Workspace" items={appSecondaryItems} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
