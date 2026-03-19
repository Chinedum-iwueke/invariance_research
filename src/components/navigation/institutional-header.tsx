"use client";

import Link from "next/link";
import { ChevronDown, CircleUserRound, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { headerNavGroups } from "@/content/header-navigation";
import { cn } from "@/lib/utils";

function LogoSlot() {
  return (
    <Link href="/" className="inline-flex h-9 items-center rounded-sm px-2 text-sm font-semibold tracking-[0.12em] text-text-institutional">
      <span className="mr-2 inline-block h-5 w-[2px] bg-brand" />
      INVARIANCE
    </Link>
  );
}

function HeaderDropdowns() {
  return (
    <div className="hidden items-center justify-center gap-1 lg:flex">
      {headerNavGroups.map((group) => (
        <div key={group.label} className="group relative">
          <button
            type="button"
            className="inline-flex h-16 items-center gap-1.5 px-4 text-xs font-bold tracking-[0.12em] text-text-graphite transition-colors hover:text-text-institutional"
          >
            {group.label}
            <ChevronDown className="h-3.5 w-3.5 text-brand/70" />
          </button>
          <span className="absolute bottom-0 left-3 right-3 h-0.5 origin-left scale-x-0 bg-brand transition-transform duration-normal group-hover:scale-x-100 group-focus-within:scale-x-100" />
          <div className="invisible absolute left-1/2 top-[calc(100%-0.35rem)] z-[55] w-56 -translate-x-1/2 rounded-sm border border-border-subtle bg-surface-white p-2 opacity-0 shadow-raised transition-all duration-normal group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-sm px-3 py-2 text-sm text-text-graphite transition-colors hover:bg-surface-panel hover:text-text-institutional"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountArea({ authenticated }: { authenticated: boolean }) {
  if (authenticated) {
    return (
      <Link
        href="/account"
        className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-subtle bg-surface-white px-3 text-sm text-text-graphite hover:bg-surface-panel"
      >
        <CircleUserRound className="h-4 w-4" />
        Account
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/login" className="text-sm text-text-neutral hover:text-text-institutional">
        Log In
      </Link>
      <Link href="/signup" className={buttonVariants({ size: "sm", variant: "secondary" })}>
        Sign Up
      </Link>
    </div>
  );
}

export function InstitutionalHeader({ authenticated = false }: { authenticated?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b bg-surface-white/95 backdrop-blur">
      <div className="container-shell flex h-[4.5rem] items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <LogoSlot />
          <HeaderDropdowns />
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/contact" className={buttonVariants({ size: "sm" })}>
            Request Audit
          </Link>
          <AccountArea authenticated={authenticated} />
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-subtle lg:hidden"
          aria-label="Toggle header navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("border-t lg:hidden", mobileOpen ? "block" : "hidden")}>
        <div className="container-shell space-y-3 py-4">
          {headerNavGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-[11px] font-bold tracking-[0.12em] text-text-neutral">{group.label}</p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="block rounded-sm px-2 py-1 text-sm hover:bg-surface-panel">
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Link href="/contact" onClick={() => setMobileOpen(false)} className={buttonVariants({ size: "sm" })}>
              Request Audit
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
