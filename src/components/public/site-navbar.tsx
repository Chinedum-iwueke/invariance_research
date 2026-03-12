"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SiteNavbarProps {
  links: readonly { label: string; href: string }[];
}

export function SiteNavbar({ links }: SiteNavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-[var(--z-sticky)] border-b bg-white/95 backdrop-blur">
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          Invariance Research
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-text-neutral hover:text-text-institutional">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/research-standards" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            View Research Standards
          </Link>
          <Link href="/contact" className={buttonVariants({ size: "sm" })}>
            Request Audit
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border lg:hidden"
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("border-t lg:hidden", open ? "block" : "hidden")}>
        <div className="container-shell flex flex-col gap-3 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-sm px-2 py-1 text-sm text-text-graphite hover:bg-surface-panel"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/research-standards" onClick={() => setOpen(false)} className={buttonVariants({ size: "sm", variant: "secondary" })}>
              Standards
            </Link>
            <Link href="/contact" onClick={() => setOpen(false)} className={buttonVariants({ size: "sm" })}>
              Request Audit
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
