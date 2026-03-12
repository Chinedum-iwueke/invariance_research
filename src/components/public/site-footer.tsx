import Link from "next/link";

interface FooterGroup {
  title: string;
  links: readonly { label: string; href: string }[];
}

export function SiteFooter({ groups }: { groups: readonly FooterGroup[] }) {
  return (
    <footer className="mt-section-xl border-t bg-surface-panel/30">
      <div className="container-shell py-section-md">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-wide">Invariance Research</p>
            <p className="max-w-md text-sm text-text-neutral">
              Independent quantitative validation studio focused on execution-aware strategy evaluation and robustness diagnostics.
            </p>
          </div>
          {groups.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{group.title}</p>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-text-graphite hover:text-brand">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t pt-6 text-xs text-text-neutral">© {new Date().getFullYear()} Invariance Research. All rights reserved.</div>
      </div>
    </footer>
  );
}
