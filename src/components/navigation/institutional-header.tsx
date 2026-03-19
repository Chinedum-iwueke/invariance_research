"use client";

import Link from "next/link";
import { ChevronDown, CircleUserRound, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandLogoLink } from "@/components/ui/logo";
import { buttonVariants } from "@/components/ui/button";
import { headerNavGroups } from "@/content/header-navigation";
import { cn } from "@/lib/utils";

function HeaderDropdowns({ compact }: { compact: boolean }) {
  return (
    <div className="hidden items-center gap-1.5 xl:gap-2 lg:flex">
      {headerNavGroups.map((group) => (
        <div key={group.label} className="group relative">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 text-xs font-bold tracking-[0.12em] text-text-graphite transition-colors hover:text-text-institutional",
              compact ? "h-14" : "h-16",
            )}
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
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b bg-surface-white/95 backdrop-blur">
      <div className={cn("container-shell flex items-center gap-3 transition-[height,padding] duration-normal", compact ? "h-20" : "h-[5.5rem]")}>
        <div className="flex min-w-0 items-center">
          <BrandLogoLink compact={compact} className={cn("-ml-1", compact ? "h-14" : "h-16")} />
        </div>

        <div className="hidden lg:ml-12 lg:flex xl:ml-16">
          <HeaderDropdowns compact={compact} />
        </div>

        <div className="hidden items-center gap-2 lg:ml-auto lg:flex">
          <Link href="/contact" className={buttonVariants({ size: "sm" })}>
            Request Audit
          </Link>
          <AccountArea authenticated={authenticated} />
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-subtle lg:hidden"
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
