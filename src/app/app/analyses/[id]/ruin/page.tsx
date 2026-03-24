import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { metricsFromScoreBands, selectRuinTopMetrics, toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { artifactRepository } from "@/lib/server/repositories/artifact-repository";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function readAssumptionValue(assumptions: Array<{ name: string; value: string }>, aliases: string[]) {
  const target = new Set(aliases.map((alias) => normalizeToken(alias)));
  const found = assumptions.find((assumption) => target.has(normalizeToken(assumption.name)));
  return found?.value;
}

function stringifyMetadataValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
  if (typeof value === "string" && value.trim().length > 0) return value;
  return undefined;
}

function classifyAssumptionCompleteness(accountSize?: string, riskPerTrade?: string) {
  if (accountSize && riskPerTrade) return "complete";
  if (accountSize || riskPerTrade) return "partial";
  return "missing";
}

export default async function RuinPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const artifact = artifactRepository.findById(analysis.artifact_id);
  const access = resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "ruin", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Risk of Ruin",
      diagnosticPurpose: "Estimate capital survivability and catastrophic drawdown exposure under stress assumptions.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Professional",
    });
    return (
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const ruin = record.diagnostics.ruin;
  const envelopeStatus = ruin.status ?? "limited";
  const assumptions = record.diagnostics.ruin.assumptions;
  const limitations = ruin.limitations ?? [];
  const recommendations = ruin.recommendations ?? [];
  const metadata = ruin.metadata ?? {};
  const selectedMetrics = selectRuinTopMetrics(record.diagnostics.ruin.metrics, 4);
  const metrics = metricsFromScoreBands(selectedMetrics, {
    "Probability of Ruin": "Unavailable when explicit capital+sizing assumptions were not emitted.",
    "Expected Stress Drawdown": "Unavailable when the engine does not emit stress-linked drawdown under a ruin model.",
    "Survival Probability": "Unavailable unless survivability output was emitted for this run.",
    "Max Tolerable Risk per Trade": "Unavailable unless risk-per-trade sensitivity was emitted for this run.",
  });

  const accountSize = readAssumptionValue(assumptions, ["account_size", "account size", "starting capital", "initial capital"])
    ?? stringifyMetadataValue(metadata.account_size);
  const riskPerTrade = readAssumptionValue(assumptions, ["risk_per_trade_pct", "risk per trade", "risk_per_trade"])
    ?? stringifyMetadataValue(metadata.risk_per_trade_pct);
  const sizingModel = readAssumptionValue(assumptions, ["sizing_model", "position sizing model", "sizing policy"])
    ?? (typeof metadata.position_sizing_model === "string" ? metadata.position_sizing_model : undefined);
  const artifactRichness = readAssumptionValue(assumptions, ["artifact richness", "artifact_richness"])
    ?? (typeof metadata.artifact_richness === "string" ? metadata.artifact_richness : undefined)
    ?? "Not emitted";
  const tradeCount = readAssumptionValue(assumptions, ["trade count", "trade_count"])
    ?? (typeof metadata.trade_count === "number" ? `${metadata.trade_count}` : undefined)
    ?? `${record.dataset.trade_count}`;
  const assumptionsCompleteness = classifyAssumptionCompleteness(accountSize, riskPerTrade);
  const stressLinkage = Boolean(metadata.monte_carlo_linked || metadata.monte_carlo_reference || metadata.simulation_paths || metadata.n_paths)
    ? "Monte-Carlo-linked"
    : "Standalone";
  const ruinModelStatus = assumptionsCompleteness === "complete" && envelopeStatus === "available" ? "Full" : "Limited";
  const ruinModelMethod = readAssumptionValue(assumptions, ["ruin model method", "method", "model type"])
    ?? (typeof metadata.method === "string" ? metadata.method : undefined)
    ?? (stressLinkage === "Monte-Carlo-linked" ? "Monte Carlo-linked" : "Proxy/standalone");

  const figure = ruin.figure;
  const figureEmptyMessage = assumptionsCompleteness === "missing"
    ? "Risk of Ruin requires explicit capital and sizing assumptions (for example account size and risk per trade). This run is trade-only, so a full ruin/survival surface was not emitted."
    : "A ruin/survivability figure was not emitted for this run (`diagnostics.ruin.figures` missing or empty), so this page can only show metric/assumption context.";

  const interpretationBullets = [
    `Sizing survivability signal: ${ruinModelStatus === "Full" ? "model-ready" : "limited"} (${assumptionsCompleteness} assumptions).`,
    `Main driver clarity: ${riskPerTrade ? `risk-per-trade assumption provided (${riskPerTrade}).` : "risk-per-trade assumption is missing."}`,
    `Confidence: ${ruinModelStatus === "Full" ? "moderate to high (subject to listed limitations)." : "low; trade-only context cannot stand in for full capital survivability modeling."}`,
  ];

  const riskScenarios = Array.isArray(metadata.risk_scenarios)
    ? metadata.risk_scenarios
        .map((scenario) => {
          if (!scenario || typeof scenario !== "object") return undefined;
          const entry = scenario as Record<string, unknown>;
          const risk = stringifyMetadataValue(entry.risk_per_trade_pct ?? entry.risk_per_trade ?? entry.risk);
          const ruin = stringifyMetadataValue(entry.probability_of_ruin ?? entry.ruin_probability ?? entry.ruin_probability_pct);
          return risk && ruin ? { risk, ruin } : undefined;
        })
        .filter((entry): entry is { risk: string; ruin: string } => Boolean(entry))
    : [];

  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability and catastrophic drawdown exposure.">
      <div className="grid gap-3 md:grid-cols-4">
        <WorkspaceCard title="Artifact richness" subtitle="Input depth available">{artifactRichness}</WorkspaceCard>
        <WorkspaceCard title="Sizing assumptions" subtitle="Unlock condition">{assumptionsCompleteness}</WorkspaceCard>
        <WorkspaceCard title="Ruin model status" subtitle="Limited vs full">{ruinModelStatus}</WorkspaceCard>
        <WorkspaceCard title="Stress linkage" subtitle="Model context">{stressLinkage}</WorkspaceCard>
      </div>
      <MetricRow metrics={metrics} cols={4} />
      <FigureCard
        title={figure?.title ?? "Capital Survivability Surface"}
        subtitle={figure?.subtitle ?? "Ruin probability / survival behavior under emitted sizing assumptions."}
        figure={<DiagnosticFigure figure={figure} emptyMessage={figureEmptyMessage} />}
        note={figure?.note}
      />
      <WorkspaceCard title="Ruin assumptions" subtitle="Core inputs driving survivability estimates">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-2">
          <ul className="space-y-2">
            <li><span className="font-medium text-text-graphite">Account size:</span> {accountSize ?? "Missing"}</li>
            <li><span className="font-medium text-text-graphite">Risk per trade:</span> {riskPerTrade ?? "Missing"}</li>
            <li><span className="font-medium text-text-graphite">Sizing model:</span> {sizingModel ?? "Not emitted"}</li>
            <li><span className="font-medium text-text-graphite">Ruin model method:</span> {ruinModelMethod}</li>
          </ul>
          <ul className="space-y-2">
            <li><span className="font-medium text-text-graphite">Artifact richness:</span> {artifactRichness}</li>
            <li><span className="font-medium text-text-graphite">Trade count:</span> {tradeCount}</li>
            <li><span className="font-medium text-text-graphite">Assumption completeness:</span> {assumptionsCompleteness}</li>
            <li><span className="font-medium text-text-graphite">Stress linkage:</span> {stressLinkage}</li>
          </ul>
        </div>
        <p className="mt-4 text-xs text-text-neutral">
          Risk of Ruin requires explicit capital and sizing assumptions, such as account size and risk per trade, to estimate survivability. Trade-only uploads provide limited ruin context rather than full ruin analysis.
        </p>
      </WorkspaceCard>
      <WorkspaceCard title="Survivability guidance" subtitle="Engine-native limitations and recommendations">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-text-graphite">Limitations</p>
            <ul className="space-y-1">
              {(limitations.length ? limitations : [
                "No explicit ruin limitations were emitted by the engine for this run.",
                "Without account_size + risk_per_trade_pct, ruin interpretation is intentionally limited.",
              ]).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium text-text-graphite">Recommendations</p>
            <ul className="space-y-1">
              {([
                ...recommendations,
                ...(riskPerTrade ? [] : ["Provide risk_per_trade_pct so survivability can be estimated instead of inferred."]),
                ...(accountSize ? [] : ["Provide account_size to translate trade outcomes into capital survivability context."]),
                "Lower risk per trade if ruin probability remains elevated.",
                "Use Monte Carlo-linked stress output when available for higher-confidence survivability context.",
              ]).filter((item, idx, arr) => arr.indexOf(item) === idx).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </WorkspaceCard>
      {riskScenarios.length > 0 ? (
        <WorkspaceCard title="Risk-per-trade sensitivity scenarios" subtitle="Engine-emitted ruin sensitivity">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-neutral">
              <thead className="text-text-graphite">
                <tr>
                  <th className="py-1 pr-2">Risk per trade</th>
                  <th className="py-1 pr-2">Ruin probability</th>
                </tr>
              </thead>
              <tbody>
                {riskScenarios.map((scenario) => (
                  <tr key={`${scenario.risk}-${scenario.ruin}`} className="border-t border-border-subtle">
                    <td className="py-1 pr-2">{scenario.risk}</td>
                    <td className="py-1 pr-2">{scenario.ruin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkspaceCard>
      ) : null}
      <WorkspaceCard title="What this page does not yet include" subtitle="Current methodological boundaries">
        <ul className="space-y-1 text-sm text-text-neutral">
          <li>• No dynamic position sizing path model.</li>
          <li>• No portfolio-level cross-asset correlation ruin integration.</li>
          <li>• No liquidity-shock + slippage amplification in ruin paths.</li>
          <li>• No regime-aware ruin transition model.</li>
        </ul>
      </WorkspaceCard>
      <InterpretationBlock
        {...toInterpretationBlockPayload({
          ...record.diagnostics.ruin.interpretation,
          bullets: [...(record.diagnostics.ruin.interpretation.bullets ?? []), ...interpretationBullets],
        })}
      />
      <WorkspaceCard title="Unlock full Risk of Ruin analysis" subtitle="What changes this page from limited to full">
        <ul className="space-y-1 text-sm text-text-neutral">
          <li>• Trade-only uploads: limited ruin context only.</li>
          <li>• Full ruin analysis unlocks when both <span className="font-medium text-text-graphite">account_size</span> and <span className="font-medium text-text-graphite">risk_per_trade_pct</span> are provided.</li>
          <li>• Monte Carlo/stress outputs improve confidence and allow richer survivability surfaces.</li>
          </ul>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
