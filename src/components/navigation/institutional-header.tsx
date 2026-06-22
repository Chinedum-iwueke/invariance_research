"use client";

import Link from "next/link";
import { ChevronDown, CircleUserRound, LogIn, Menu, PanelsTopLeft, X } from "lucide-react";
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
          {group.href ? (
            <Link
              href={group.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 text-xs font-bold tracking-[0.12em] text-text-graphite transition-colors hover:text-text-institutional",
                compact ? "h-14" : "h-16",
              )}
            >
              {group.label}
            </Link>
          ) : (
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
          )}
          <span className="absolute bottom-0 left-3 right-3 h-0.5 origin-left scale-x-0 bg-brand transition-transform duration-normal group-hover:scale-x-100 group-focus-within:scale-x-100" />
          {!group.href && (
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
          )}
        </div>
      ))}
    </div>
  );
}

function AccountArea({ authenticated }: { authenticated: boolean }) {
  if (authenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/app" className={buttonVariants({ size: "sm", className: "gap-2" })}>
          <PanelsTopLeft className="h-4 w-4" /> Research Desk
        </Link>
        <Link
          href="/account"
          aria-label="Account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-subtle bg-surface-white text-text-graphite hover:bg-surface-panel"
        >
          <CircleUserRound className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/login" className={buttonVariants({ size: "sm", variant: "secondary", className: "gap-2" })}>
        <LogIn className="h-4 w-4" />
        <span>Sign In</span>
      </Link>
    </div>
  );
}

export function InstitutionalHeader({ authenticated = false }: { authenticated?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border-strong/70 bg-surface-paper/94 backdrop-blur">
      <div className={cn("container-shell flex items-center gap-3 transition-[height,padding] duration-normal", compact ? "h-20" : "h-[5.5rem]")}>
        <div className="flex min-w-0 items-center">
          <BrandLogoLink compact={compact} className={cn("-ml-1", compact ? "h-14" : "h-16")} />
        </div>

        <div className="hidden lg:ml-12 lg:flex xl:ml-16">
          <HeaderDropdowns compact={compact} />
        </div>

        <div className="hidden items-center gap-2 lg:ml-auto lg:flex">
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

      <div className={cn("overflow-hidden border-t bg-surface-white/98 shadow-soft backdrop-blur lg:hidden", mobileOpen ? "max-h-[calc(100svh-5rem)] opacity-100" : "max-h-0 opacity-0", "transition-[max-height,opacity] duration-300 ease-out")}>
        <div className="container-shell max-h-[calc(100svh-5rem)] overflow-y-auto py-3">
          {headerNavGroups.map((group) => (
            <div key={group.label} className="border-b border-border-subtle/70 last:border-b-0">
              {group.href ? (
                <Link href={group.href} onClick={() => setMobileOpen(false)} className="flex min-h-12 w-full items-center py-2 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-neutral">{group.label}</span>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
                    className="flex min-h-12 w-full items-center justify-between gap-4 py-2 text-left"
                    aria-expanded={Boolean(openGroups[group.label])}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-neutral">{group.label}</span>
                    <ChevronDown className={cn("h-4 w-4 text-brand transition-transform duration-300", openGroups[group.label] && "rotate-180")} />
                  </button>
                  <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", openGroups[group.label] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <div className="overflow-hidden">
                      <div className="space-y-1 pb-3">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="block rounded-sm border-l-2 border-transparent px-3 py-2.5 text-sm text-text-graphite transition-colors hover:border-brand hover:bg-surface-panel"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 items-center gap-2 pt-4">
            {authenticated ? (
              <>
                <Link href="/app" onClick={() => setMobileOpen(false)} className={buttonVariants({ size: "sm", className: "w-full gap-2" })}>
                  <PanelsTopLeft className="h-4 w-4" /> Research Desk
                </Link>
                <Link href="/account" onClick={() => setMobileOpen(false)} className={buttonVariants({ size: "sm", variant: "secondary", className: "w-full gap-2" })}>
                  <CircleUserRound className="h-4 w-4" /> Account
                </Link>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} className={buttonVariants({ size: "sm", variant: "secondary", className: "w-full gap-2" })}>
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
            <div className="flex justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
