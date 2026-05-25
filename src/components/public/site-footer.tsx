import Link from "next/link";

interface FooterGroup {
  title: string;
  links: readonly { label: string; href: string }[];
}

export function SiteFooter({ groups }: { groups: readonly FooterGroup[] }) {
  return (
    <footer className="mt-section-lg border-t border-border-strong bg-surface-panel/55 md:mt-section-xl">
      <div className="container-shell py-10 md:py-section-md">
        <div className="grid gap-8 md:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] md:gap-8 lg:gap-10">
          <div className="space-y-3 border-b border-border-subtle/70 pb-6 md:border-b-0 md:pb-0">
            <p className="font-display text-3xl leading-none">Invariance Research</p>
            <p className="max-w-md text-sm leading-relaxed text-text-neutral">
              Evidence-led strategy validation for teams that need every claim, limitation, and diagnostic traceable before capital is deployed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:contents">
            {groups.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-neutral">{group.title}</p>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm leading-snug text-text-graphite hover:text-brand">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t pt-5 text-xs leading-relaxed text-text-neutral md:mt-12 md:pt-6">© {new Date().getFullYear()} Invariance Research. All rights reserved.</div>
      </div>
    </footer>
  );
}
