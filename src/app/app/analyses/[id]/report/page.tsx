import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { overviewDiagnostic, reportSections } from "@/lib/mock/analysis";

export default function ReportPage() {
  return (
    <AnalysisPageFrame title="Validation Report" description="Structured final deliverable with executive interpretation and section references.">
      <WorkspaceCard title="Executive Summary" subtitle="Institutional snapshot">
        <p className="text-sm text-text-neutral">Alpha Trend v2 demonstrates moderate robustness with identifiable fragility under execution stress and regime drift. Deployment is feasible with conservative risk controls.</p>
      </WorkspaceCard>

      <VerdictCard title={overviewDiagnostic.verdict.title} summary={overviewDiagnostic.verdict.summary} posture={overviewDiagnostic.verdict.posture} />

      <WorkspaceCard title="Assumptions" subtitle="Methodology and execution context">
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Transaction costs modeled with variable slippage bands.</li>
          <li>• Trade sequence perturbations applied in Monte Carlo stress.</li>
          <li>• Regime segmentation by volatility and trend proxy.</li>
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="Diagnostic sections" subtitle="Navigate to source pages">
        <div className="grid gap-2 md:grid-cols-2">
          {reportSections.map((section) => (
            <Link key={section.title} href={section.href} className="rounded-sm border p-3 text-sm hover:bg-surface-panel">
              {section.title}
            </Link>
          ))}
        </div>
      </WorkspaceCard>

      <div className="flex flex-wrap gap-2">
        <button className={buttonVariants({ variant: "secondary" })}>Export Report (placeholder)</button>
        <Link href="/contact" className={buttonVariants()}>Request Full Audit</Link>
      </div>
    </AnalysisPageFrame>
  );
}
