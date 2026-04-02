import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { RuinDrawdownChart } from "@/components/diagnostics/ruin/ruin-drawdown-chart";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
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

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function parsePct(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value <= 1 ? value * 100 : value);
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[%,$]/g, "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.abs(parsed <= 1 ? parsed * 100 : parsed);
}

function parseCurrency(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fmtPct(value?: number, digits = 1) {
  return value === undefined ? "Unavailable" : `${value.toFixed(digits)}%`;
}

function fmtCount(value?: number) {
  return value === undefined ? "Unavailable" : `${Math.round(value)}`;
}

function fmtCurrency(value?: number) {
  if (value === undefined) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function readMetricValue(metrics: Array<{ label: string; value: string; numeric_value?: number }>, aliases: string[]): number | undefined {
  const aliasSet = new Set(aliases.map((item) => normalizeToken(item)));
  const metric = metrics.find((entry) => aliasSet.has(normalizeToken(entry.label)));
  if (!metric) return undefined;
  return metric.numeric_value ?? parseCurrency(metric.value) ?? parsePct(metric.value);
}

function topCard(title: string, value: string, subtitle: string) {
  return (
    <WorkspaceCard title={title} subtitle={subtitle}>
      <p className="text-2xl font-semibold text-text-graphite">{value}</p>
    </WorkspaceCard>
  );
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
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability, drawdown breach probabilities, and execution stress tolerance.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Risk of Ruin" description="Capital survivability, drawdown breach probabilities, and execution stress tolerance.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const ruin = record.diagnostics.ruin;
  const ruinEnvelope = record.engine_payload.diagnostics.ruin;
  const assumptions = ruin.assumptions;
  const metadata = (ruin.metadata ?? {}) as Record<string, unknown>;
  const summaryMetrics = (metadata.summary_metrics ?? {}) as Record<string, unknown>;
  const streakStats = (metadata.streak_statistics ?? {}) as Record<string, unknown>;
  const executionStressSummary = (metadata.execution_stress_summary ?? {}) as Record<string, unknown>;
  const ruinFigures = ruin.figures?.length ? ruin.figures : (ruinEnvelope?.figures ?? []);

  const accountSize = parseCurrency(readAssumptionValue(assumptions, ["account_size", "account size", "starting capital", "initial capital"]) ?? metadata.account_size);
  const riskPerTradePct = parsePct(readAssumptionValue(assumptions, ["risk_per_trade_pct", "risk per trade", "risk_per_trade"]) ?? metadata.risk_per_trade_pct);
  const computedRiskAmountPerTrade = accountSize !== undefined && riskPerTradePct !== undefined
    ? accountSize * (riskPerTradePct / 100)
    : undefined;
  const riskAmountPerTrade = computedRiskAmountPerTrade ?? parseCurrency(metadata.risk_amount_per_trade ?? summaryMetrics.risk_amount_per_trade);

  const probabilityOfRuin = parsePct(metadata.probability_of_ruin)
    ?? parsePct(summaryMetrics.probability_of_ruin)
    ?? readMetricValue(ruinEnvelope?.summary_metrics ?? [], ["probability of ruin", "risk-of-ruin probability"]);
  const worstDrawdownPct = parsePct(metadata.worst_drawdown_pct) ?? parsePct(summaryMetrics.worst_drawdown_pct);
  const p95DrawdownPct = parsePct(metadata.drawdown_95_pct ?? metadata.p95_drawdown_pct);
  const minimumSurvivableCapital = parseCurrency(metadata.minimum_survivable_capital ?? summaryMetrics.minimum_survivable_capital);
  const maxTolerableRiskPerTrade = parsePct(metadata.max_tolerable_risk_per_trade ?? summaryMetrics.max_tolerable_risk_per_trade);
  const maxConsecutiveLosses = asNumber(metadata.max_consecutive_losses ?? summaryMetrics.max_consecutive_losses ?? streakStats.max_consecutive_losses);
  const maxConsecutiveWins = asNumber(metadata.max_consecutive_wins ?? summaryMetrics.max_consecutive_wins ?? streakStats.max_consecutive_wins);
  const avgLosingStreak = asNumber(metadata.average_losing_streak ?? summaryMetrics.average_losing_streak ?? streakStats.average_losing_streak);
  const medLosingStreak = asNumber(metadata.median_losing_streak ?? summaryMetrics.median_losing_streak ?? streakStats.median_losing_streak);
  const avgWinningStreak = asNumber(metadata.average_winning_streak ?? summaryMetrics.average_winning_streak ?? streakStats.average_winning_streak);
  const medWinningStreak = asNumber(metadata.median_winning_streak ?? summaryMetrics.median_winning_streak ?? streakStats.median_winning_streak);
  const longestLosingStreakPnl = parseCurrency(metadata.longest_losing_streak_pnl ?? summaryMetrics.longest_losing_streak_pnl ?? streakStats.longest_losing_streak_pnl);
  const longestLosingStreakR = asNumber(metadata.longest_losing_streak_r ?? summaryMetrics.longest_losing_streak_r ?? streakStats.longest_losing_streak_r);

  const curveFigure = ruinFigures.find((item) => item.figure_id === "ruin_probability_curve")
    ?? ruin.figure
    ?? ruinFigures[0];
  const riskSensitivityFigure = ruinFigures.find((item) => item.figure_id === "risk_per_trade_sensitivity");
  const lossStreakFigure = ruinFigures.find((item) => item.figure_id === "loss_streak_distribution");

  const scenarios = Array.isArray(metadata.scenario_curves) ? metadata.scenario_curves : [];
  const hasStressedScenario = scenarios.some((entry) => typeof entry === "object" && entry && String((entry as Record<string, unknown>).name ?? "").toLowerCase().includes("stress"));

  const capitalHitWorstStreak = accountSize !== undefined && longestLosingStreakPnl !== undefined ? accountSize + longestLosingStreakPnl : undefined;
  const capitalAfterP95 = accountSize !== undefined && p95DrawdownPct !== undefined ? accountSize * (1 - p95DrawdownPct / 100) : undefined;
  const capitalAfterWorstSim = accountSize !== undefined && worstDrawdownPct !== undefined ? accountSize * (1 - worstDrawdownPct / 100) : undefined;

  const topCards = [
    topCard("Probability of Ruin", fmtPct(probabilityOfRuin), "Probability of crossing the ruin boundary."),
    topCard("Max Consecutive Losses", fmtCount(maxConsecutiveLosses), "Observed or simulated longest losing run."),
    topCard("Worst Drawdown", fmtPct(worstDrawdownPct), "Worst simulated/estimated drawdown severity."),
    minimumSurvivableCapital !== undefined ? topCard("Minimum Survivable Capital", fmtCurrency(minimumSurvivableCapital), "Minimum capital level implied by the ruin model.") : null,
    maxTolerableRiskPerTrade !== undefined ? topCard("Max Tolerable Risk / Trade", fmtPct(maxTolerableRiskPerTrade), "Upper bound before survivability materially degrades.") : null,
    longestLosingStreakPnl !== undefined ? topCard("Worst Losing-Streak PnL", fmtCurrency(longestLosingStreakPnl), "Historical streak burden in currency terms.") : null,
  ].filter((item): item is JSX.Element => Boolean(item)).slice(0, 6);

  const sizingPosture = riskPerTradePct === undefined
    ? "Sizing posture is unclassified because risk-per-trade was not emitted."
    : riskPerTradePct <= 0.5
      ? "Current sizing appears conservative for a risk-averse posture."
      : riskPerTradePct <= 1.5
        ? "Current sizing is elevated but can be tolerable if drawdown tolerance is moderate."
        : "Current sizing is aggressive and may be intolerable for risk-averse users.";

  const limitations = ruin.limitations?.length ? ruin.limitations : ["Ruin limitations were not explicitly emitted by the engine for this run."];
  const recommendations = ruin.recommendations?.length ? ruin.recommendations : ["Reduce risk per trade if drawdown breach probabilities are outside your tolerance."];

  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Decision-grade survivability view across drawdowns, streak burden, and execution stress.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{topCards}</div>

      <WorkspaceCard title="Capital Survivability" subtitle="Translate drawdowns and streaks into account-level impact at current sizing.">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-3">
          <p><span className="font-medium text-text-graphite">Account size:</span> {fmtCurrency(accountSize)}</p>
          <p><span className="font-medium text-text-graphite">Risk per trade:</span> {fmtPct(riskPerTradePct, 2)}</p>
          <p><span className="font-medium text-text-graphite">Risk amount per trade:</span> {fmtCurrency(riskAmountPerTrade ?? (accountSize !== undefined && riskPerTradePct !== undefined ? accountSize * (riskPerTradePct / 100) : undefined))}</p>
          <p><span className="font-medium text-text-graphite">Remaining after worst losing streak:</span> {fmtCurrency(capitalHitWorstStreak)}</p>
          <p><span className="font-medium text-text-graphite">Remaining after p95 drawdown:</span> {fmtCurrency(capitalAfterP95)}</p>
          <p><span className="font-medium text-text-graphite">Remaining after worst simulated drawdown:</span> {fmtCurrency(capitalAfterWorstSim)}</p>
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        title="Probability of Breaching Drawdown Thresholds"
        subtitle="Monte Carlo drawdown-threshold curve with capital-aware interpretation."
        note="Interpretation: higher breach probabilities at shallower thresholds indicate fragile survivability; deeper thresholds should have equal or lower probability."
      >
        <RuinDrawdownChart figure={curveFigure} accountSize={accountSize} />
        <p className="mt-3 text-sm text-text-neutral">
          This curve shows the estimated probability of breaching each drawdown threshold. If account size is available, tooltip values translate each threshold into direct capital impact.
          Compare threshold probabilities directly to your personal drawdown tolerance and required capital reserve.
        </p>
      </WorkspaceCard>

      <WorkspaceCard title="Streak Analytics" subtitle="Losing-streak burden remains primary for survivability and execution tolerance.">
        <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-text-graphite">Max consecutive losses:</span> {fmtCount(maxConsecutiveLosses)}</p>
          <p><span className="font-medium text-text-graphite">Max consecutive wins:</span> {fmtCount(maxConsecutiveWins)}</p>
          <p><span className="font-medium text-text-graphite">Average losing streak:</span> {fmtCount(avgLosingStreak)}</p>
          <p><span className="font-medium text-text-graphite">Median losing streak:</span> {fmtCount(medLosingStreak)}</p>
          <p><span className="font-medium text-text-graphite">Average winning streak:</span> {fmtCount(avgWinningStreak)}</p>
          <p><span className="font-medium text-text-graphite">Median winning streak:</span> {fmtCount(medWinningStreak)}</p>
          <p><span className="font-medium text-text-graphite">Longest losing streak PnL:</span> {fmtCurrency(longestLosingStreakPnl)}</p>
          <p><span className="font-medium text-text-graphite">Longest losing streak (R):</span> {longestLosingStreakR === undefined ? "Unavailable" : `${longestLosingStreakR.toFixed(2)}R`}</p>
        </div>
        {lossStreakFigure ? (
          <div className="mt-4">
            <DiagnosticFigure figure={lossStreakFigure} height={340} />
          </div>
        ) : null}
      </WorkspaceCard>

      <WorkspaceCard title="Execution Stress Survivability" subtitle="Baseline vs stressed survivability framing under degradation assumptions.">
        <div className="space-y-2 text-sm text-text-neutral">
          <p><span className="font-medium text-text-graphite">Scenario curves:</span> {scenarios.length ? `${scenarios.length} emitted` : "Not emitted (single-curve view shown)"}</p>
          <p><span className="font-medium text-text-graphite">Baseline vs stressed distinction:</span> {hasStressedScenario ? "Available" : "Summary-level interpretation only"}</p>
          <p>
            {hasStressedScenario
              ? "Stressed curves are available in payload metadata and should be interpreted as execution-friction survivability degradation versus baseline."
              : "No explicit stressed scenario curve was emitted. Treat execution stress conclusions as directional and rely on summary-level warnings/limitations."}
          </p>
          {Object.keys(executionStressSummary).length > 0 ? (
            <p>Execution stress summary was emitted and mapped into ruin metadata for interpretation alongside the main curve.</p>
          ) : null}
        </div>
        {riskSensitivityFigure ? (
          <div className="mt-4">
            <FigureCard
              title={riskSensitivityFigure.title || "Risk Per Trade Sensitivity"}
              subtitle={riskSensitivityFigure.subtitle || "Ruin response as risk-per-trade changes"}
              figure={<DiagnosticFigure figure={riskSensitivityFigure} height={320} />}
              note={riskSensitivityFigure.note}
            />
          </div>
        ) : null}
      </WorkspaceCard>

      <WorkspaceCard title="Interpretation & Action" subtitle="Sizing-aware, risk-tolerance-aware decision framing.">
        <div className="space-y-3 text-sm text-text-neutral">
          <p>
            Survivability means keeping drawdown and losing-streak burden inside limits you can tolerate without forced de-risking. For risk-averse users,
            focus on low breach probability at moderate drawdown thresholds and on streak burden that remains financially and psychologically tolerable.
          </p>
          <p>
            For users willing to tolerate higher volatility, deeper drawdown exposure may be acceptable only if capital buffers remain ample and stressed execution
            does not materially raise ruin risk.
          </p>
          <p>{sizingPosture} Reducing risk per trade generally improves survivability non-linearly when tail drawdown risk is elevated.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 font-medium text-text-graphite">Limitations</p>
              <ul className="space-y-1">{limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-text-graphite">Recommendations</p>
              <ul className="space-y-1">{recommendations.map((item) => <li key={item}>• {item}</li>)}</ul>
            </div>
          </div>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
