import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function DistributionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);

  if (!record) {
    return (
      <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Trade Distribution" description="Statistical structure of trade outcomes beyond aggregate PnL.">
      <MetricRow metrics={metricsFromScoreBands(record.diagnostics.distribution.metrics)} cols={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        {record.diagnostics.distribution.figures.map((figure) => (
          <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle} figure={<DiagnosticFigure figure={figure} />} note={figure.note} />
        ))}
      </div>
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.distribution.interpretation)} />
    </AnalysisPageFrame>
  );
}
