import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { resolveActiveResearchStandard } from "@/lib/server/publications/repository";

export const metadata: Metadata = {
  title: "Research Standards | Invariance Research",
  description: "Institutional validation standards for execution-aware strategy evaluation and robustness diagnostics.",
};

export default function ResearchStandardsPage() {
  const sectionIds = ["hero", "standards-pdf", "summary", "cta"];
  const activeStandard = resolveActiveResearchStandard();

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            eyebrow="Authority Publication"
            title="Research Standards"
            description="Institutional guidance for validating quantitative strategies under realistic execution and market stress conditions."
            primaryCta={{ label: activeStandard ? "Download PDF" : "Browse Research", href: activeStandard?.pdf_url ?? "/research" }}
            secondaryCta={{ label: "View Methodology", href: "/methodology" }}
          />
        </section>

        <section id="standards-pdf" className="container-shell py-section-sm">
          <Card className="space-y-4 p-card-lg">
            <SectionHeader title="Research Standards Document" description="The currently active publication used across the public standards page." />
            {activeStandard ? (
              <>
                <div className="rounded-sm border border-border-subtle bg-surface-panel p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-brand">Active Standard</p>
                  <h3 className="mt-2 text-xl font-semibold">{activeStandard.title}</h3>
                  <p className="mt-2 text-sm text-text-neutral">{activeStandard.summary}</p>
                  <p className="mt-3 text-xs text-text-neutral">Published {activeStandard.published_at?.slice(0, 10) ?? "-"} · source: {activeStandard.source}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link className="rounded-sm border px-4 py-2 hover:bg-surface-panel" href={activeStandard.pdf_url}>Download PDF</Link>
                  <Link className="rounded-sm border px-4 py-2 hover:bg-surface-panel" href={activeStandard.viewer_url}>Open Viewer</Link>
                  <Link className="rounded-sm border px-4 py-2 hover:bg-surface-panel" href={`/research/${activeStandard.slug}`}>Read Summary</Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-neutral">No published research standard is active yet. Publish one through admin or the manual content source.</p>
            )}
          </Card>
        </section>

        <section id="summary" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="HTML Summary" description="Condensed standards for teams reviewing strategy quality and implementation viability." />
          <div className="grid gap-4">
            {[
              ["01 — Execution Realism", "Validate under spread, slippage, latency, and liquidity constraints."],
              ["02 — Robustness Integrity", "Test parameter stability and sensitivity across diverse windows."],
              ["03 — Regime Awareness", "Assess strategy behavior across structural market conditions."],
              ["04 — Capital Discipline", "Map drawdown concentration, risk-of-ruin, and leverage stress."],
              ["05 — Reporting Standards", "Document assumptions, methods, limitations, and action guidance."],
            ].map(([title, body]) => (
              <Card key={title} className="p-card-md">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-text-neutral">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Apply the standards to your strategy pipeline"
            description="Use the Robustness Lab for automated diagnostics or request an independent analyst audit."
            primary={{ label: "Explore Robustness Lab", href: "/robustness-lab" }}
            secondary={{ label: "Request Strategy Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
