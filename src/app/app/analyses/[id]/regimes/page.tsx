import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { Card } from "@/components/ui/card";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { metricsFromScoreBands, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function regimeBadge(classification?: "regime_dependent" | "regime_agnostic" | "fragile" | "informational") {
  if (classification === "fragile") return { text: "Fragile", tone: "border-red-300 bg-red-50 text-red-700" };
  if (classification === "regime_agnostic") return { text: "Regime-agnostic", tone: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive" };
  if (classification === "regime_dependent") return { text: "Regime-dependent", tone: "border-amber-300 bg-amber-50 text-amber-700" };
  return { text: "Informational", tone: "border-border-subtle bg-surface-panel text-text-neutral" };
}

export default async function RegimesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "regimes", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Regime Analysis",
      diagnosticPurpose: "Decompose performance by volatility and trend structure to identify deployment conditions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Research Lab",
      artifactRequirementProfile: "regime_analysis",
    });
    return (
      <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const regimes = record.diagnostics.regimes;
  const classification = regimeBadge(regimes.classification);
  const summaryMetrics = [
    { label: "Best regime", value: regimes.summary_metrics?.best_regime ?? "Unavailable" },
    { label: "Worst regime", value: regimes.summary_metrics?.worst_regime ?? "Unavailable" },
    { label: "Regime dispersion", value: regimes.summary_metrics?.regime_dispersion ?? "Unavailable" },
    { label: "Dominant regime", value: regimes.summary_metrics?.dominant_regime ?? "Unavailable" },
  ];
  const primaryFigure = (regimes.figures ?? []).find((figure) => figure.type === "bar" || figure.type === "grouped_bar") ?? regimes.figures?.[0];
  const secondaryFigures = (regimes.figures ?? []).filter((figure) => figure.figure_id !== primaryFigure?.figure_id);
  const definitionThresholds = regimes.definition?.thresholds?.length ? regimes.definition.thresholds : ["Thresholds were not emitted in this run payload."];

  const interpretationBullets = [
    `Best regime: ${regimes.summary_metrics?.best_regime ?? "Unavailable"}.`,
    `Worst regime: ${regimes.summary_metrics?.worst_regime ?? "Unavailable"}.`,
    `Classification: ${classification.text}.`,
    ...(regimes.interpretation.bullets ?? []),
  ];

  return (
    <AnalysisPageFrame title="Regime Analysis" description="Performance decomposition by volatility and trend structure.">
      <Card className="flex items-center justify-between rounded-md border bg-surface-panel/45 p-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Regime dependence classification</p>
          <p className="text-sm font-semibold text-text-institutional">{classification.text}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classification.tone}`}>{classification.text}</span>
      </Card>

      <MetricRow metrics={summaryMetrics} cols={4} />
      <MetricRow metrics={metricsFromScoreBands(regimes.metrics)} cols={4} />

      <FigureCard
        title={primaryFigure?.title ?? "Performance by Regime"}
        subtitle={primaryFigure?.subtitle ?? "Bar chart of strategy behavior across trend/volatility states."}
        figure={<DiagnosticFigure figure={primaryFigure} emptyMessage="No regime bar chart was emitted for this run payload." />}
        note={primaryFigure?.note}
      />

      {secondaryFigures.length ? (
        <div className="space-y-5">
          {secondaryFigures.map((figure) => (
            <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle} figure={<DiagnosticFigure figure={figure} />} note={figure.note} />
          ))}
        </div>
      ) : null}

      <WorkspaceCard title="Regime performance table" subtitle="Where edge exists vs where edge fails">
        {regimes.regime_metrics.length === 0 ? (
          <p className="text-sm text-text-neutral">
            No per-regime rows were emitted in <code>diagnostics.regime.regime_metrics</code> for this run. The surface does not fabricate proxy regime rows.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-text-neutral">
              <thead className="text-xs uppercase tracking-[0.08em] text-text-neutral">
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">Regime</th>
                  <th className="px-2 py-2 font-semibold">Trade count</th>
                  <th className="px-2 py-2 font-semibold">Expectancy</th>
                  <th className="px-2 py-2 font-semibold">Win rate</th>
                  <th className="px-2 py-2 font-semibold">Drawdown</th>
                </tr>
              </thead>
              <tbody>
                {regimes.regime_metrics.map((row) => (
                  <tr key={row.regime_name} className="border-b border-border-subtle/80">
                    <td className="px-2 py-2 font-medium text-text-graphite">{row.regime_name}</td>
                    <td className="px-2 py-2">{row.trade_count ?? "—"}</td>
                    <td className="px-2 py-2">{row.expectancy ?? "—"}</td>
                    <td className="px-2 py-2">{row.win_rate ?? "—"}</td>
                    <td className="px-2 py-2">{row.drawdown ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Regime definition" subtitle="How trend and volatility states were classified">
        <ul className="space-y-1.5 text-sm text-text-neutral">
          <li>• Trend method: {regimes.definition?.trend_method ?? "Not emitted"}</li>
          <li>• Volatility method: {regimes.definition?.volatility_method ?? "Not emitted"}</li>
          {definitionThresholds.map((threshold, index) => <li key={`threshold-${index}-${threshold.slice(0, 24)}`}>• Threshold: {threshold}</li>)}
          {regimes.definition?.notes ? <li>• Notes: {regimes.definition.notes}</li> : null}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="What this does not include" subtitle="Scope boundaries for this diagnostic">
        <ul className="space-y-1.5 text-sm text-text-neutral">
          <li>• No macro regimes.</li>
          <li>• No liquidity regimes.</li>
          <li>• No execution regimes.</li>
          <li>• No forward regime prediction.</li>
        </ul>
      </WorkspaceCard>

      <InterpretationBlock
        {...toInterpretationBlockPayload({ ...regimes.interpretation, bullets: interpretationBullets })}
        cautions={[
          `Deployment posture should be aligned to ${classification.text.toLowerCase()} behavior.`,
          ...(regimes.recommendations ?? []),
        ]}
        caveats={regimes.limitations ?? []}
      />

      <div className="grid gap-4 2xl:grid-cols-2">
        <WorkspaceCard title="Assumptions" subtitle="Engine-emitted regime assumptions">
          {(regimes.assumptions ?? []).length ? (
            <ul className="space-y-1.5 text-sm text-text-neutral">
              {(regimes.assumptions ?? []).map((item, index) => <li key={`assumption-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-text-neutral">No explicit regime assumptions were emitted for this run.</p>
          )}
        </WorkspaceCard>
        <WorkspaceCard title="Recommendations" subtitle="Engine-emitted deployment guidance">
          {(regimes.recommendations ?? []).length ? (
            <ul className="space-y-1.5 text-sm text-text-neutral">
              {(regimes.recommendations ?? []).map((item, index) => <li key={`recommendation-${index}-${item.slice(0, 24)}`}>• {item}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-text-neutral">No regime-specific recommendations were emitted for this run.</p>
          )}
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
