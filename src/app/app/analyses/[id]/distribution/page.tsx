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
      <WorkspaceCard title="Trade-level summary" subtitle="Derived from persisted analysis payload">
        <ul className="space-y-2 text-sm text-text-neutral">
          <li>• Trade count: <span className="font-medium text-text-graphite">{record.dataset.trade_count}</span></li>
          <li>• Coverage window: <span className="font-medium text-text-graphite">{record.dataset.start_date ?? "N/A"} → {record.dataset.end_date ?? "N/A"}</span></li>
          <li>• Key findings available: <span className="font-medium text-text-graphite">{record.summary.key_findings.length}</span></li>
        </ul>
      </WorkspaceCard>
      <InterpretationBlock {...toInterpretationBlockPayload(record.diagnostics.distribution.interpretation)} />
    </AnalysisPageFrame>
  );
}
