import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { overviewDiagnostic, reportSections } from "@/lib/mock/analysis";

export default function ReportPage() {
  return (
    <AnalysisPageFrame
      title="Validation Report"
      description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance."
    >
      <WorkspaceCard title="Report Header" subtitle="Research artifact metadata">
        <div className="grid gap-2 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-text-graphite">Strategy:</span> Alpha Trend v2</p>
          <p><span className="font-medium text-text-graphite">Date:</span> 2026-03-12</p>
          <p><span className="font-medium text-text-graphite">Scope:</span> Full diagnostic suite</p>
          <p><span className="font-medium text-text-graphite">Asset:</span> US Equities</p>
        </div>
      </WorkspaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Executive Summary" subtitle="Institutional snapshot">
          <p className="text-sm leading-relaxed text-text-neutral">
            Alpha Trend v2 demonstrates moderate robustness with identifiable fragility under execution stress and regime drift. Deployment is feasible only with conservative sizing and explicit risk controls.
          </p>
        </WorkspaceCard>
        <VerdictCard
          title={overviewDiagnostic.verdict.title}
          summary={overviewDiagnostic.verdict.summary}
          posture={overviewDiagnostic.verdict.posture}
        />
      </div>

      <WorkspaceCard title="Diagnostics Summary" subtitle="Quick access to supporting diagnostics">
        <div className="grid gap-2 md:grid-cols-2">
          {reportSections.map((section) => (
            <Link key={section.title} href={section.href} className="rounded-sm border p-3 text-sm text-text-graphite hover:bg-surface-panel">
              {section.title}
            </Link>
          ))}
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Methodology Assumptions" subtitle="Execution and stress model context">
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Transaction costs modeled with variable spread and slippage bands.</li>
          <li>• Trade-sequence perturbations applied through Monte Carlo stress.</li>
          <li>• Regime decomposition by volatility and trend-strength proxies.</li>
        </ul>
      </WorkspaceCard>

      <InterpretationBlock
        title="Final Recommendations"
        body="Proceed with constrained capital allocation and explicit monitoring gates. Trigger a full review if slippage or regime behavior deviates from baseline assumptions."
        bullets={[
          "Use conservative position sizing until further stability validation.",
          "Monitor execution drift in high-volatility windows.",
          "Escalate to independent audit for governance-critical mandates.",
        ]}
      />

      <WorkspaceCard title="Export & Share" subtitle="Report artifact actions">
        <div className="flex flex-wrap gap-2">
          <button className={buttonVariants({ variant: "secondary" })}>Export Report (placeholder)</button>
          <button className={buttonVariants({ variant: "secondary" })}>Share Link (placeholder)</button>
          <Link href="/contact" className={buttonVariants()}>
            Need an independent validation audit?
          </Link>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
