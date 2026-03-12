import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  logo?: string;
  links: NavItem[];
  sticky?: boolean;
}

export function Navbar({ logo = "Invariance Research", links, sticky = true }: NavbarProps) {
  return (
    <nav className={cn("border-b bg-white/95 backdrop-blur", sticky && "sticky top-0 z-[var(--z-sticky)]")}>
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-wide text-text-institutional">
          {logo}
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-text-neutral hover:text-text-institutional">
              {link.label}
            </Link>
          ))}
        </div>
        <Button size="sm">Request Access</Button>
      </div>
    </nav>
  );
}
