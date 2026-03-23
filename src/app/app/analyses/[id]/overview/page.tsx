import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Overview" description="Immediate robustness and risk posture for this strategy under execution-aware validation.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Overview" description="Immediate robustness and risk posture for this strategy under execution-aware validation.">
      <FigureCard
        title={record.diagnostics.overview.figure.title}
        subtitle={record.diagnostics.overview.figure.subtitle}
        figure={<DiagnosticFigure figure={record.diagnostics.overview.figure} />}
        note={record.diagnostics.overview.figure.note}
      />

      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.overview.metrics)} />

      <div className="grid gap-5 2xl:grid-cols-[1.3fr_0.9fr]">
        <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.overview.interpretation)} />
        <VerdictCard title={record.diagnostics.overview.verdict.title} summary={record.diagnostics.overview.verdict.summary} posture={record.diagnostics.overview.verdict.status} />
      </div>

      <WorkspaceCard title="Methodology posture" subtitle="Validation sequence applied to this artifact">
        <p className="text-sm leading-relaxed text-text-neutral">{record.run_context.notes ?? "No additional methodology notes were persisted for this analysis."}</p>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
