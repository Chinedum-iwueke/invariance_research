import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Research Standards | Invariance Research",
  description: "Institutional validation standards for execution-aware strategy evaluation and robustness diagnostics.",
};

export default function ResearchStandardsPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          eyebrow="Authority Publication"
          title="Research Standards"
          description="Institutional guidance for validating quantitative strategies under realistic execution and market stress conditions."
          primaryCta={{ label: "Download PDF", href: "#standards-pdf" }}
          secondaryCta={{ label: "View Methodology", href: "/methodology" }}
        />

        <section id="standards-pdf" className="container-shell py-section-sm">
          <Card className="space-y-4 p-card-lg">
            <SectionHeader title="Research Standards Document" description="PDF publication and summary briefing." />
            <div className="aspect-[16/9] rounded-sm border bg-surface-panel" />
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="rounded-sm border px-4 py-2 hover:bg-surface-panel" href="#">
                Download PDF
              </a>
              <a className="rounded-sm border px-4 py-2 hover:bg-surface-panel" href="#">
                Open Viewer
              </a>
            </div>
          </Card>
        </section>

        <section className="container-shell space-y-6 py-section-sm">
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

        <section className="container-shell py-section-md">
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
