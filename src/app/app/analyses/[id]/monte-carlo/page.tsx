import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function MonteCarloPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Monte Carlo Crash Test" description="Path-perturbation simulation evaluating drawdown severity and survivability under adverse sequencing.">
      <FigureCard
        title={record.diagnostics.monte_carlo.figure.title}
        subtitle={record.diagnostics.monte_carlo.figure.subtitle}
        figure={<DiagnosticFigure figure={record.diagnostics.monte_carlo.figure} />}
        note={record.diagnostics.monte_carlo.figure.note}
      />

      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.monte_carlo.metrics)} cols={4} />

      <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.95fr]">
        <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.monte_carlo.interpretation)} />
        <WorkspaceCard title="Warnings" subtitle="Engine and eligibility notes">
          {record.diagnostics.monte_carlo.warnings.length === 0 ? (
            <p className="text-sm text-text-neutral">No warnings were emitted for this run.</p>
          ) : (
            <ul className="space-y-2 text-sm text-text-neutral">
              {record.diagnostics.monte_carlo.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>• {warning.message}</li>
              ))}
            </ul>
          )}
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
