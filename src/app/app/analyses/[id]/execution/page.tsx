import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { Card } from "@/components/ui/card";
import { figureTypes, logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { metricsFromScoreBands, selectExecutionTopMetrics, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function toneForScenario(classification?: "survives" | "fragile" | "negative" | "informational") {
  if (classification === "survives") return "text-chart-positive";
  if (classification === "negative") return "text-red-700";
  if (classification === "fragile") return "text-amber-700";
  return "text-text-neutral";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "execution", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Execution Sensitivity",
      diagnosticPurpose: "Evaluate edge resilience under worsened spread, slippage, and fee assumptions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Professional",
      artifactRequirementProfile: "execution_sensitivity",
    });
    return (
      <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const execution = record.diagnostics.execution;
  const executionFigures = execution.figures ?? [];
  const executionFigure = executionFigures.find((figure) => figure.figure_id === "execution_expectancy_decay")
    ?? executionFigures.find((figure) => figure.series.length > 0)
    ?? executionFigures[0]
    ?? execution.figure;
  const selectedFigures = executionFigure
    ? [executionFigure, ...executionFigures.filter((figure) => figure.figure_id !== executionFigure.figure_id)]
    : executionFigures;
  const executionBranch = executionFigures.length > 0
    ? "native_figures_branch"
    : executionFigure
      ? (executionFigure.provenance === "reconstructed_from_trades" || executionFigure.provenance === "synthesized_fallback"
          ? "fallback_reconstructed_branch"
          : "singular_figure_branch")
      : "empty_state_branch";
  const executionEmptyReason = executionBranch === "empty_state_branch"
    ? "no figures on record (diagnostics.execution.figures empty and diagnostics.execution.figure missing)"
    : undefined;
  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "execution",
    input_figure_count: executionFigures.length,
    input_figure_types: figureTypes(executionFigures),
    singular_figure_present: Boolean(execution.figure),
    fallback_figure_source_available: Boolean(execution.figure) || executionFigures.some((figure) => figure.provenance === "reconstructed_from_trades" || figure.provenance === "synthesized_fallback"),
    selected_figure_count: selectedFigures.length,
    selected_figure_types: figureTypes(selectedFigures),
    branch: executionBranch,
    empty_state_reason: executionEmptyReason,
  });
  const topMetrics = selectExecutionTopMetrics(execution.metrics, 6);
  const metricHelpers = {
    "Baseline Expectancy": "Expected edge under baseline execution costs.",
    "Stressed Expectancy": "Expected edge after stress cost increments.",
    "Edge Decay": "Percent edge loss from baseline to stressed assumptions.",
    "Baseline Win Rate": "Observed win rate under baseline execution costs.",
    "Stressed Win Rate": "Observed win rate under stressed execution assumptions.",
    "Baseline Profit Factor": "Gross-profit/gross-loss ratio under baseline execution costs.",
    "Stressed Profit Factor": "Gross-profit/gross-loss ratio under stressed execution assumptions.",
  };
  const noScenarioReason = execution.assumptions?.length
    ? "The engine did not emit structured per-scenario rows for this run despite having cost assumptions."
    : "The engine did not emit execution cost assumptions, so a scenario matrix could not be constructed.";
  const figureMissingReason = "No persisted execution sensitivity figure is currently available for this run.";
  const assumptionRows = execution.assumptions?.length
    ? execution.assumptions
    : ["No baseline cost assumptions were emitted by the engine payload for this run."];
  const limitations = execution.limitations?.length
    ? execution.limitations
    : [
      "No order-book simulation.",
      "No explicit market-impact model.",
      "No latency modeling.",
      "No venue-specific execution routing model.",
    ];
  const dominantCostDriver = execution.recommendations?.find((item) => /spread|slippage|fee|commission|cost/i.test(item))
    ?? execution.interpretation.bullets?.find((item) => /dominant cost driver/i.test(item));

  return (
    <AnalysisPageFrame title="Execution Sensitivity" description="Edge resilience under worsened spread, slippage, and fee assumptions.">
      <Card className="grid gap-3 rounded-md border bg-surface-panel/50 p-3 md:grid-cols-2 2xl:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Artifact completeness</p>
          <p className="text-sm font-semibold text-text-institutional">{titleCase(execution.artifact_completeness ?? "unknown")}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Execution model</p>
          <p className="text-sm font-semibold text-text-institutional">{titleCase(execution.execution_model ?? "baseline")}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Stress realism</p>
          <p className="text-sm font-semibold text-text-institutional">{titleCase(execution.stress_realism ?? "limited")}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Sensitivity classification</p>
          <p className="text-sm font-semibold text-text-institutional">{titleCase(execution.sensitivity_classification ?? "informational")}</p>
        </div>
      </Card>

      <FigureCard
        title={executionFigure?.title ?? "Execution Cost Sensitivity"}
        subtitle={executionFigure?.subtitle ?? "Expectancy response across higher execution friction assumptions."}
        figure={<DiagnosticFigure figure={executionFigure} emptyMessage={figureMissingReason} />}
        note={executionFigure?.note}
      />
      {executionFigures.length > 1 ? (
        <div className="space-y-5">
          {executionFigures.slice(1).map((figure) => (
            <FigureCard key={figure.figure_id} title={figure.title} subtitle={figure.subtitle} figure={<DiagnosticFigure figure={figure} />} note={figure.note} />
          ))}
        </div>
      ) : null}
      <MetricRow metrics={metricsFromScoreBands(topMetrics, metricHelpers)} cols={3} />

      <WorkspaceCard title="Scenario matrix" subtitle="Stress cases ranked by execution survivability">
        {execution.scenarios.length === 0 ? (
          <p className="text-sm text-text-neutral">{noScenarioReason}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-text-neutral">
              <thead className="text-xs uppercase tracking-[0.08em] text-text-neutral">
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">Scenario</th>
                  <th className="px-2 py-2 font-semibold">Spread</th>
                  <th className="px-2 py-2 font-semibold">Slippage</th>
                  <th className="px-2 py-2 font-semibold">Fee</th>
                  <th className="px-2 py-2 font-semibold">Expectancy</th>
                  <th className="px-2 py-2 font-semibold">Win rate</th>
                  <th className="px-2 py-2 font-semibold">Profit factor</th>
                  <th className="px-2 py-2 font-semibold">Average R</th>
                  <th className="px-2 py-2 font-semibold">Edge decay</th>
                  <th className="px-2 py-2 font-semibold">Classification</th>
                </tr>
              </thead>
              <tbody>
                {execution.scenarios.map((scenario) => (
                  <tr key={`${scenario.name}-${scenario.assumption}`} className="border-b border-border-subtle/80">
                    <td className="px-2 py-2">
                      <p className="font-medium text-text-graphite">{scenario.name}</p>
                      <p className="text-xs text-text-neutral">{scenario.assumption}</p>
                    </td>
                    <td className="px-2 py-2">{scenario.spread ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.slippage ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.fee ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.expectancy ?? scenario.impact}</td>
                    <td className="px-2 py-2">{scenario.win_rate ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.profit_factor ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.average_r ?? "—"}</td>
                    <td className="px-2 py-2">{scenario.edge_decay_pct ?? "—"}</td>
                    <td className={`px-2 py-2 font-medium ${toneForScenario(scenario.classification)}`}>{titleCase(scenario.classification ?? "informational")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Execution assumptions" subtitle="Cost model and stress increments used in this run">
        <ul className="space-y-2 text-sm text-text-neutral">
          {assumptionRows.map((assumption, index) => (
            <li key={`assumption-${index}-${assumption.slice(0, 24)}`}>• {assumption}</li>
          ))}
          <li>• Deterministic proxy execution modeling uses trades-only outcomes and does not depend on OHLCV bars/order book reconstruction.</li>
          <li>• Assumption provenance: {execution.assumptions?.length ? "Provided by engine payload" : "Inferred as limited from missing structured assumptions"}.</li>
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="What this test does not include" subtitle="Execution realism boundaries">
        <ul className="space-y-1.5 text-sm text-text-neutral">
          {[
            "No order-book simulation.",
            "No market-impact model.",
            "No latency effects model.",
            "No venue-specific execution modeling.",
          ].map((item, index) => (
            <li key={`scope-${index}-${item.slice(0, 24)}`}>• {item}</li>
          ))}
        </ul>
      </WorkspaceCard>

      <InterpretationBlock
        {...toInterpretationBlockPayload(execution.interpretation)}
        cautions={[
          `Risk level: ${titleCase(execution.sensitivity_classification ?? "informational")}.`,
          ...(dominantCostDriver ? [`Dominant cost driver signal: ${dominantCostDriver}.`] : []),
        ]}
        caveats={limitations}
      />
    </AnalysisPageFrame>
  );
}
