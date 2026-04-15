import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { FigureCard } from "@/components/dashboard/figure-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { getRenderableSeries } from "@/lib/app/figure-rendering";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { buildTruthContext } from "@/lib/app/context-truth";
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

function parseFractionPercent(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value <= 1 ? value * 100 : value);
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[%,$]/g, "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.abs(parsed <= 1 ? parsed * 100 : parsed);
}

function parsePercentUnits(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value);
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? Math.abs(parsed) : undefined;
}

function resolveFirstPercentCandidate(candidates: unknown[]): number | undefined {
  for (const candidate of candidates) {
    const parsed = parsePercentUnits(candidate);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
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
  return metric.numeric_value ?? parseCurrency(metric.value) ?? parseFractionPercent(metric.value);
}

function hasFigureId(figure: { figure_id?: string; id?: string }, targetId: string) {
  const normalize = (v?: string) => (typeof v === "string" ? v.trim().toLowerCase() : undefined);

  const target = normalize(targetId);
  const semantic = normalize(figure.id);
  const generated = normalize(figure.figure_id);

  return semantic === target || generated === target;
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
  const riskPerTradePct = parsePercentUnits(readAssumptionValue(assumptions, ["risk_per_trade_pct", "risk per trade", "risk_per_trade"]) ?? metadata.risk_per_trade_pct);
  const computedRiskAmountPerTrade = accountSize !== undefined && riskPerTradePct !== undefined
    ? accountSize * (riskPerTradePct / 100)
    : undefined;
  const riskAmountPerTrade = computedRiskAmountPerTrade ?? parseCurrency(metadata.risk_amount_per_trade ?? summaryMetrics.risk_amount_per_trade);

  const probabilityOfRuin = parseFractionPercent(metadata.probability_of_ruin)
    ?? parseFractionPercent(summaryMetrics.probability_of_ruin)
    ?? readMetricValue(ruinEnvelope?.summary_metrics ?? [], ["probability of ruin", "risk-of-ruin probability"]);
  const worstDrawdownPct = parsePercentUnits(metadata.worst_drawdown_pct) ?? parsePercentUnits(summaryMetrics.worst_drawdown_pct);
  const p95DrawdownPct = parsePercentUnits(metadata.drawdown_95_pct ?? metadata.p95_drawdown_pct);
  const resolvedP95DrawdownPct = resolveFirstPercentCandidate([
    metadata.p95_drawdown_pct,
    metadata.drawdown_p95_pct,
    metadata.p95_drawdown,
    metadata.drawdown_95_pct,
    metadata.p95DrawdownPct,
    metadata.capital_survivability && typeof metadata.capital_survivability === "object" ? (metadata.capital_survivability as Record<string, unknown>).p95_drawdown_pct : undefined,
    metadata.capital_survivability && typeof metadata.capital_survivability === "object" ? (metadata.capital_survivability as Record<string, unknown>).drawdown_p95_pct : undefined,
    metadata.capital_survivability && typeof metadata.capital_survivability === "object" ? (metadata.capital_survivability as Record<string, unknown>).p95_drawdown : undefined,
    summaryMetrics.p95_drawdown_pct,
    summaryMetrics.drawdown_p95_pct,
    summaryMetrics.p95_drawdown,
    summaryMetrics.drawdown_95_pct,
    summaryMetrics.p95DrawdownPct,
  ]) ?? p95DrawdownPct;
  const minimumSurvivableCapital = parseCurrency(metadata.minimum_survivable_capital ?? summaryMetrics.minimum_survivable_capital);
  const maxTolerableRiskPerTrade = parseFractionPercent(metadata.max_tolerable_risk_per_trade ?? summaryMetrics.max_tolerable_risk_per_trade);
  const maxConsecutiveLosses = asNumber(metadata.max_consecutive_losses ?? summaryMetrics.max_consecutive_losses ?? streakStats.max_consecutive_losses);
  const maxConsecutiveWins = asNumber(metadata.max_consecutive_wins ?? summaryMetrics.max_consecutive_wins ?? streakStats.max_consecutive_wins);
  const avgLosingStreak = asNumber(metadata.average_losing_streak ?? summaryMetrics.average_losing_streak ?? streakStats.average_losing_streak);
  const medLosingStreak = asNumber(metadata.median_losing_streak ?? summaryMetrics.median_losing_streak ?? streakStats.median_losing_streak);
  const avgWinningStreak = asNumber(metadata.average_winning_streak ?? summaryMetrics.average_winning_streak ?? streakStats.average_winning_streak);
  const medWinningStreak = asNumber(metadata.median_winning_streak ?? summaryMetrics.median_winning_streak ?? streakStats.median_winning_streak);
  const longestLosingStreakPnl = parseCurrency(metadata.longest_losing_streak_pnl ?? summaryMetrics.longest_losing_streak_pnl ?? streakStats.longest_losing_streak_pnl);
  const longestLosingStreakR = asNumber(metadata.longest_losing_streak_r ?? summaryMetrics.longest_losing_streak_r ?? streakStats.longest_losing_streak_r);

  const curveFigure = ruinFigures.find((item) => hasFigureId(item, "ruin_probability_curve"))
    ?? (hasFigureId(ruin.figure ?? {}, "ruin_probability_curve") ? ruin.figure : undefined)
    ?? ruinFigures.find((item) => item.type === "line");
  const riskSensitivityFigure = ruinFigures.find((item) => hasFigureId(item, "risk_per_trade_sensitivity"));
  const lossStreakFigure = ruinFigures.find((item) => hasFigureId(item, "loss_streak_distribution"));
  const riskSensitivityRenderability = getRenderableSeries(riskSensitivityFigure);
  const lossStreakRenderability = getRenderableSeries(lossStreakFigure);

  const scenarios = Array.isArray(metadata.scenario_curves) ? metadata.scenario_curves : [];
  const hasStressedScenario = scenarios.some((entry) => typeof entry === "object" && entry && String((entry as Record<string, unknown>).name ?? "").toLowerCase().includes("stress"));

  const capitalHitWorstStreak = accountSize !== undefined && longestLosingStreakPnl !== undefined ? accountSize + longestLosingStreakPnl : undefined;
  const capitalAfterP95 = accountSize !== undefined && resolvedP95DrawdownPct !== undefined ? accountSize * (1 - Math.abs(resolvedP95DrawdownPct) / 100) : undefined;
  const capitalAfterWorstSim = accountSize !== undefined && worstDrawdownPct !== undefined ? accountSize * (1 - Math.abs(worstDrawdownPct) / 100) : undefined;

  const topCards = [
    { key: "probability_of_ruin", title: "Probability of Ruin", value: fmtPct(probabilityOfRuin), subtitle: "Probability of crossing the ruin boundary." },
    { key: "max_consecutive_losses", title: "Max Consecutive Losses", value: fmtCount(maxConsecutiveLosses), subtitle: "Observed or simulated longest losing run." },
    { key: "worst_drawdown", title: "Worst Drawdown", value: fmtPct(worstDrawdownPct), subtitle: "Worst simulated/estimated drawdown severity." },
    { key: "minimum_survivable_capital", title: "Minimum Survivable Capital", value: fmtCurrency(minimumSurvivableCapital), subtitle: "Minimum capital level implied by the ruin model." },
    { key: "max_tolerable_risk_per_trade", title: "Max Tolerable Risk / Trade", value: fmtPct(maxTolerableRiskPerTrade), subtitle: "Upper bound before survivability materially degrades." },
    { key: "worst_losing_streak_pnl", title: "Worst Losing-Streak PnL", value: fmtCurrency(longestLosingStreakPnl), subtitle: "Historical streak burden in currency terms." },
  ];

  const sizingPosture = riskPerTradePct === undefined
    ? "Sizing posture is unclassified because risk-per-trade was not emitted."
    : riskPerTradePct <= 0.5
      ? "Current sizing appears conservative for a risk-averse posture."
      : riskPerTradePct <= 1.5
        ? "Current sizing is elevated but can be tolerable if drawdown tolerance is moderate."
        : "Current sizing is aggressive and may be intolerable for risk-averse users.";

  const truthContext = buildTruthContext(record, "ruin");

  return (
    <AnalysisPageFrame title="Risk of Ruin" description="Decision-grade survivability view across drawdowns, streak burden, and execution stress.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {topCards.map((card) => (
          <WorkspaceCard key={card.key} title={card.title} subtitle={card.subtitle}>
            <p className="text-2xl font-semibold text-text-graphite">{card.value}</p>
          </WorkspaceCard>
        ))}
      </div>

      <WorkspaceCard title="Capital Survivability" subtitle="Translate drawdowns and streaks into account-level impact at current sizing.">
        <div className="grid gap-4 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-3">
          <p><span className="font-medium text-text-graphite">Account size:</span> {fmtCurrency(accountSize)}</p>
          <p><span className="font-medium text-text-graphite">Risk per trade:</span> {fmtPct(riskPerTradePct, 2)}</p>
          <p><span className="font-medium text-text-graphite">Risk amount per trade:</span> {fmtCurrency(riskAmountPerTrade ?? (accountSize !== undefined && riskPerTradePct !== undefined ? accountSize * (riskPerTradePct / 100) : undefined))}</p>
          <p><span className="font-medium text-text-graphite">p95 drawdown:</span> {fmtPct(resolvedP95DrawdownPct)}</p>
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
        {curveFigure ? (
          <>
            <DiagnosticFigure figure={curveFigure} height={480} />
            <p className="mt-3 text-sm text-text-neutral">
              This curve shows the estimated probability of breaching each drawdown threshold. If account size is available, tooltip values translate each threshold into direct capital impact.
              Compare threshold probabilities directly to your personal drawdown tolerance and required capital reserve.
            </p>
          </>
        ) : (
          <p className="text-sm text-text-neutral">
            The ruin probability curve was not emitted for this run. Use summary metrics and streak analytics below for survivability interpretation.
          </p>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Secondary survivability charts" subtitle="Presence and renderability are surfaced explicitly for both secondary figures.">
        <div className="space-y-6">
          {riskSensitivityFigure ? (
            <FigureCard
              title={riskSensitivityFigure.title || "Risk Per Trade Sensitivity"}
              subtitle={riskSensitivityFigure.subtitle || "How ruin probability rises as sizing risk increases"}
              figure={riskSensitivityRenderability.series.length > 0
                ? <DiagnosticFigure figure={riskSensitivityFigure} height={480} />
                : <p className="text-sm text-text-neutral">Figure payload is present but series data could not be rendered for this run.</p>}
              note={riskSensitivityFigure.note}
            />
          ) : (
            <WorkspaceCard title="Risk Per Trade Sensitivity" subtitle="Secondary figure fallback">
              <p className="text-sm text-text-neutral">Figure absent from ruin payload (risk_per_trade_sensitivity not found).</p>
            </WorkspaceCard>
          )}
          {lossStreakFigure ? (
            <FigureCard
              title={lossStreakFigure.title || "Loss Streak Distribution"}
              subtitle={lossStreakFigure.subtitle || "Distribution of losing-run length severity"}
              figure={lossStreakRenderability.series.length > 0
                ? <DiagnosticFigure figure={lossStreakFigure} height={480} />
                : <p className="text-sm text-text-neutral">Figure payload is present but series data could not be rendered for this run.</p>}
              note={lossStreakFigure.note}
            />
          ) : (
            <WorkspaceCard title="Loss Streak Distribution" subtitle="Secondary figure fallback">
              <p className="text-sm text-text-neutral">Figure absent from ruin payload (loss_streak_distribution not found).</p>
            </WorkspaceCard>
          )}
        </div>
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
      </WorkspaceCard>

      <WorkspaceCard title="Interpretation & Action" subtitle="Sizing-aware, risk-tolerance-aware decision framing.">
        <div className="space-y-3 text-sm text-text-neutral">
          <p>
            {probabilityOfRuin !== undefined && probabilityOfRuin >= 25
              ? "At current sizing, survivability risk appears elevated: breach probabilities and tail-drawdown exposure are high enough to merit active de-risking."
              : "Current survivability appears more stable, but drawdown-threshold probabilities should still be judged against hard capital and behavioral limits."}
          </p>
          <p>
            Conservative allocators should require low breach risk at shallow-to-moderate drawdown thresholds. Moderate-risk operators can tolerate more variance if
            capital-after-drawdown remains operationally safe. High-volatility operators may accept deeper drawdowns only when capital buffers and execution discipline remain robust.
          </p>
          <p>
            {sizingPosture}{" "}
            {resolvedP95DrawdownPct !== undefined && accountSize !== undefined
              ? `p95 drawdown implies roughly ${fmtCurrency(capitalAfterP95)} remaining capital, which should be stress-tested against your minimum operating threshold.`
              : "p95 drawdown was not fully available from this run, so tail survivability should be treated as partially observed."}
          </p>
          <p>
            If the risk-per-trade sensitivity curve steepens near current sizing, reducing risk per trade is likely to improve survivability materially rather than marginally.
            Treat this as a capital-preservation lever, not only a return-smoothing preference.
          </p>
        </div>
      </WorkspaceCard>

      <ContextFlipCard
        title="Interpretation context"
        subtitle="Truth-based assumptions, limitations, and actions for survivability."
        panes={[
          { key: "assumptions", label: "Assumptions", items: truthContext.assumptions, empty: "No explicit assumptions were emitted for this run.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: truthContext.limitations, empty: "No explicit limitations were emitted for this run.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: truthContext.recommendations, empty: "No recommendations were emitted for this run.", tone: "positive" },
        ]}
      />
    </AnalysisPageFrame>
  );
}
