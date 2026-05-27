import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { AnalystWorkbenchPanel } from "@/components/dashboard/analyst-workbench";
import { ContextFlipCard } from "@/components/dashboard/context-flip-card";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { PropEvaluationRulesForm } from "@/components/analysis/PropEvaluationRulesForm";
import { Card } from "@/components/ui/card";
import { metricsFromScoreBands } from "@/lib/app/analysis-ui";
import { buildAnalystWorkbenchModel } from "@/lib/app/analyst-workbench";
import { buildTruthContext } from "@/lib/app/context-truth";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
import { resolveDiagnosticAccess } from "@/lib/server/entitlements/policy";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { computePropEvaluationReadiness, mergePropDiagnostic } from "@/lib/server/prop-evaluation/prop-evaluation-service";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value).replace(/_/g, " ");
}

function fmtPct(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fmt(value);
  return `${value.toFixed(1)}%`;
}

function fmtCurrency(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fmt(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function fmtRuleValue(rule: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (typeof value !== "number") return fmt(value);
  if (/count|trading_days|trade_index/.test(rule)) return Number.isInteger(value) ? String(value) : value.toFixed(0);
  if (/profit|pnl|equity|target_profit/.test(rule)) return fmtCurrency(value);
  if (/pct|drawdown|loss|consistency/.test(rule)) return fmtPct(value);
  if (/target/.test(rule) && Math.abs(value) <= 100) return fmtPct(value);
  return fmt(value);
}

function recordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function labelForKey(key: string) {
  const labels: Record<string, string> = {
    ending_profit: "Ending profit",
    target_profit: "Target profit",
    ending_progress_pct: "Ending target progress",
    peak_profit: "Peak profit",
    peak_progress_pct: "Peak target progress",
    peak_profit_day: "Peak profit day",
    trading_days: "Trading days",
    target_before_breach_count: "Target before breach windows",
    breach_before_target_count: "Breach before target windows",
    unresolved_window_count: "Unresolved windows",
  };
  return labels[key] ?? titleCase(key);
}

function targetProgressRows(progress: Record<string, unknown>) {
  const order = [
    "ending_profit",
    "target_profit",
    "ending_progress_pct",
    "peak_profit",
    "peak_progress_pct",
    "peak_profit_day",
    "trading_days",
    "target_before_breach_count",
    "breach_before_target_count",
    "unresolved_window_count",
  ];
  const ordered = order
    .filter((key) => key in progress)
    .map((key) => [key, progress[key]] as const);
  const remaining = Object.entries(progress).filter(([key, value]) => !order.includes(key) && (!value || typeof value !== "object"));
  return [...ordered, ...remaining];
}

function WindowList({ title, empty, windows }: { title: string; empty: string; windows: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-panel/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-institutional">{title}</p>
        <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-neutral">{windows.length}</span>
      </div>
      {windows.length ? (
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {windows.map((window, index) => (
            <details key={`${window.start_day}-${window.end_day}-${index}`} className="group rounded-sm bg-surface-white p-3 text-sm">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <span>
                  <span className="block font-medium text-text-institutional">{fmt(window.start_day)} to {fmt(window.end_day)}</span>
                  <span className="mt-1 block text-xs text-text-neutral">
                    Resolution: {fmt(window.resolution_day ?? window.target_hit_day ?? window.breach_day ?? "unresolved")} · {fmt(window.trading_days)} day window
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] text-text-neutral group-open:border-research-red/30 group-open:text-research-red">Details</span>
              </summary>
              <div className="mt-3 grid gap-2 border-t border-border-subtle pt-3 text-xs text-text-neutral sm:grid-cols-2">
                <p>Ending profit: <span className="font-medium text-text-institutional">{fmtCurrency(window.profit)}</span> ({fmtPct(window.profit_pct)})</p>
                <p>Peak profit: <span className="font-medium text-text-institutional">{fmtCurrency(window.peak_profit)}</span> ({fmtPct(window.peak_profit_pct)})</p>
                <p>Max daily loss: <span className="font-medium text-text-institutional">{fmtPct(window.max_daily_loss_pct)}</span></p>
                <p>Max total drawdown: <span className="font-medium text-text-institutional">{fmtPct(window.max_total_drawdown_pct)}</span></p>
                {window.target_hit_day ? (
                  <p className="sm:col-span-2 text-chart-positive">
                    Target reached first on {fmt(window.target_hit_day)} at {fmtCurrency(window.target_hit_profit)} ({fmtPct(window.target_hit_profit_pct)}), trade {fmt(window.target_hit_trade_index)}.
                  </p>
                ) : null}
                {window.breach_day ? (
                  <p className="sm:col-span-2 text-chart-negative">
                    Breach {window.outcome === "target_before_breach" ? "after target" : "first"}: {fmt(window.breach_rule)} on {fmt(window.breach_day)}
                    {typeof window.breach_observed_pct === "number" ? `, observed ${fmtPct(window.breach_observed_pct)}` : ""}
                    {typeof window.breach_allowed_pct === "number" ? ` vs allowed ${fmtPct(window.breach_allowed_pct)}` : ""}.
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-neutral">{empty}</p>
      )}
    </div>
  );
}

export default async function PropEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const state = await accountService.getAccountState(session.account_id);
  const isAdmin = await isAdminIdentity({ user_id: session.user_id, email: session.email });
  const { id } = await params;
  const { analysis, record } = await requireOwnedAnalysisView(id, session.account_id);
  const artifact = await getCoreRepositories().artifacts.findById(analysis.artifact_id);
  const access = await resolveDiagnosticAccess({ account_id: session.account_id, diagnostic: "prop_evaluation_readiness", parsed_artifact: artifact?.parsed_artifact, is_admin: isAdmin });

  if (!access.allowed && access.reason !== "enabled") {
    const model = buildDiagnosticLockModel({
      state: access.reason,
      diagnosticTitle: "Prop Evaluation Readiness",
      diagnosticPurpose: "Check whether a strategy can pass a prop-firm evaluation without breaching max loss, daily loss, target, or consistency rules.",
      currentPlan: state?.account.plan_id,
      requiredPlan: "Individual",
    });
    return (
      <AnalysisPageFrame title="Prop Evaluation Readiness" description="Funding challenge feasibility, breach risk, rule edits, and improvement targets.">
        <DiagnosticLockPanel model={model} />
      </AnalysisPageFrame>
    );
  }

  if (!record) {
    return (
      <AnalysisPageFrame title="Prop Evaluation Readiness" description="Funding challenge feasibility, breach risk, rule edits, and improvement targets.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  const computedProp = artifact
    ? computePropEvaluationReadiness(artifact.parsed_artifact, analysis.runtime_config?.prop_evaluation_rules ?? artifact.parsed_artifact.prop_evaluation_rules)
    : record.diagnostics.prop_evaluation_readiness;
  const displayRecord = mergePropDiagnostic(record, computedProp);
  const prop = displayRecord.diagnostics.prop_evaluation_readiness;
  const workbench = buildAnalystWorkbenchModel(displayRecord, "prop_evaluation_readiness", { benchmark: analysis.benchmark });
  const truthContext = buildTruthContext(displayRecord, "prop_evaluation_readiness", { benchmark: analysis.benchmark });
  const metrics = metricsFromScoreBands(prop.metrics);
  const ruleSnapshot = prop.rule_snapshot ?? {};
  const firstBreach = prop.first_breach ?? undefined;
  const metadata = prop.metadata ?? {};
  const evaluationWindows = recordList(metadata.evaluation_windows);
  const targetWindows = evaluationWindows.filter((window) => window.outcome === "target_before_breach");
  const breachWindows = evaluationWindows.filter((window) => window.outcome === "breach_before_target");
  const targetEvents = recordList(metadata.target_events);
  const targetProgress = prop.target_progress ?? {};
  const decisionCard = recordValue(metadata.decision_card);
  const evidenceGrade = recordValue(metadata.evidence_grade);
  const equityEvidence = recordValue(evidenceGrade.equity);
  const brokerEvidence = recordValue(evidenceGrade.broker);
  const stressTest = recordValue(metadata.stress_test);
  const stressScenarios = recordList(stressTest.scenarios);
  const propMonteCarlo = recordValue(metadata.prop_monte_carlo);
  const improvementTargets = recordValue(metadata.improvement_targets);
  const ruleSource = String(ruleSnapshot.source ?? "fallback");
  const usingExactRules = ruleSource !== "fallback";

  return (
    <AnalysisPageFrame title="Prop Evaluation Readiness" description="Funding challenge feasibility, breach risk, rule edits, and improvement targets.">
      <AnalystWorkbenchPanel model={workbench} />

      <Card className="grid gap-3 rounded-md border bg-surface-panel/50 p-3 md:grid-cols-2 2xl:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Verdict</p>
          <p className="text-sm font-semibold text-text-institutional">{titleCase(prop.verdict)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Rule profile</p>
          <p className="text-sm font-semibold text-text-institutional">{fmt(ruleSnapshot.label ?? ruleSnapshot.firm_label)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Account size</p>
          <p className="text-sm font-semibold text-text-institutional">{fmt(ruleSnapshot.account_size)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-neutral">Rule source</p>
          <p className="text-sm font-semibold text-text-institutional">{fmt(ruleSnapshot.source)}</p>
        </div>
      </Card>

      <WorkspaceCard title="Prop survival verdict" subtitle="Unified decision from rules, path order, cost stress, sequence stress, and evidence quality">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="rounded-md border border-border-subtle bg-surface-white p-4">
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Decision card</p>
            <h2 className="mt-2 text-xl font-semibold text-text-institutional">{fmt(decisionCard.headline ?? titleCase(prop.verdict))}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-neutral">Readiness</p>
                <p className="mt-1 text-sm font-semibold text-text-institutional">{fmt(decisionCard.readiness ?? prop.verdict)}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-neutral">Confidence</p>
                <p className="mt-1 text-sm font-semibold text-text-institutional">{fmt(decisionCard.confidence ?? "bounded")}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-neutral">Cost break point</p>
                <p className="mt-1 text-sm font-semibold text-text-institutional">{fmt(stressTest.cost_break_point)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Decision blockers</p>
              {Array.isArray(decisionCard.blockers) && decisionCard.blockers.length ? (
                <div className="mt-2 grid gap-2">
                  {decisionCard.blockers.map((blocker, index) => (
                    <p key={`${index}-${String(blocker).slice(0, 24)}`} className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-neutral">{fmt(blocker)}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-text-neutral">No hard blocker was emitted by the submitted rule/evidence packet.</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Monte Carlo target-before-breach</p>
              <p className="mt-2 text-2xl font-semibold text-text-institutional">{typeof propMonteCarlo.target_before_breach_probability === "number" ? fmtPct(propMonteCarlo.target_before_breach_probability * 100) : "Unavailable"}</p>
              <p className="mt-2 text-xs leading-5 text-text-neutral">{fmt(propMonteCarlo.note)}</p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Sequence breach probability</p>
              <p className="mt-2 text-2xl font-semibold text-text-institutional">{typeof propMonteCarlo.breach_before_target_probability === "number" ? fmtPct(propMonteCarlo.breach_before_target_probability * 100) : "Unavailable"}</p>
              <p className="mt-2 text-xs leading-5 text-text-neutral">P95 max drawdown: {fmtPct(propMonteCarlo.p95_max_total_drawdown_pct)} · P10 ending profit: {fmtCurrency(propMonteCarlo.p10_ending_profit)}</p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Equity evidence</p>
              <p className="mt-2 text-sm font-semibold text-text-institutional">{fmt(equityEvidence.quality)}</p>
              <p className="mt-2 text-xs leading-5 text-text-neutral">{fmt(equityEvidence.note)}</p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Broker evidence</p>
              <p className="mt-2 text-sm font-semibold text-text-institutional">{fmt(brokerEvidence.quality)}</p>
              <p className="mt-2 text-xs leading-5 text-text-neutral">{fmt(brokerEvidence.note)}</p>
            </div>
          </div>
        </div>
      </WorkspaceCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <WorkspaceCard title="Readiness metrics" subtitle="Pass target, drawdown room, daily-loss pressure, and trading-day coverage">
          <MetricRow metrics={metrics} cols={2} />
          <div className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3 text-xs leading-5 text-text-neutral">
            <p><span className="font-semibold text-text-institutional">Windows Reaching Target First</span> is the share of rolling evaluation windows where cumulative profit reached the configured target before any configured breach. It is not the profit-target percentage itself.</p>
            <p className="mt-2"><span className="font-semibold text-text-institutional">Peak Target Progress</span> is the highest cumulative profit observed divided by the configured target profit. Values above 100% mean the path exceeded the profit target at least once; values below 100% mean it never reached the target.</p>
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="Edit rules" subtitle={usingExactRules ? "Runtime or saved rules are active; edit only if the challenge contract changed." : "Replace fallback assumptions with the actual evaluation rules."}>
          <PropEvaluationRulesForm analysisId={analysis.analysis_id} initialRules={ruleSnapshot} />
        </WorkspaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Rule status" subtitle="Each rule is checked against the emitted strategy path">
          <div className="overflow-hidden rounded-md border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-text-neutral">
                <tr>
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Observed</th>
                  <th className="px-3 py-2">Allowed</th>
                </tr>
              </thead>
              <tbody>
                {prop.rule_status.map((row) => (
                  <tr key={row.rule} className="border-t border-border-subtle">
                    <td className="px-3 py-2 font-medium text-text-institutional">{fmt(row.rule)}</td>
                    <td className={row.status === "fail" ? "px-3 py-2 font-semibold text-chart-negative" : "px-3 py-2 text-text-neutral"}>{fmt(row.status)}</td>
                    <td className="px-3 py-2 text-text-neutral">{fmtRuleValue(row.rule, row.observed)}</td>
                    <td className="px-3 py-2 text-text-neutral">{fmtRuleValue(row.rule, row.allowed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="First breach and target progress" subtitle="What would fail first, and how close the strategy gets to funding">
          <div className="space-y-4 text-sm text-text-neutral">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">First breach</p>
              <p className="mt-1 text-text-institutional">{firstBreach ? fmt(firstBreach.rule ?? firstBreach.type ?? "Rule breach") : "No configured breach detected."}</p>
              {firstBreach ? (
                <dl className="mt-2 grid gap-2 md:grid-cols-2">
                  {Object.entries(firstBreach).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-text-neutral">{fmt(key)}</dt>
                      <dd className="font-medium text-text-institutional">{fmtRuleValue(key, value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Target progress</p>
              <dl className="mt-2 grid gap-2 md:grid-cols-2">
                {targetProgressRows(targetProgress).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-text-neutral">{labelForKey(key)}</dt>
                    <dd className="font-medium text-text-institutional">{fmtRuleValue(key, value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Rolling evaluation truth</p>
              <p className="mt-1 text-text-institutional">
                {targetWindows.length} window(s) reached the profit target before any configured breach. {breachWindows.length} window(s) breached a drawdown or consistency rule before target.
              </p>
              {targetEvents[0] ? (
                <p className="mt-2 text-xs">First target hit: {fmt(targetEvents[0].day)} at {fmtCurrency(targetEvents[0].cumulative_profit)} cumulative profit.</p>
              ) : (
                <p className="mt-2 text-xs">No full-period target hit was detected before the end of the submitted trade path.</p>
              )}
            </div>
          </div>
        </WorkspaceCard>
      </div>

      <WorkspaceCard title="Execution-stressed prop survival" subtitle="Whether a small increase in round-trip costs changes the rule outcome">
        <div className="overflow-hidden rounded-md border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-text-neutral">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Target progress</th>
                <th className="px-3 py-2">Ending profit</th>
                <th className="px-3 py-2">First breach</th>
              </tr>
            </thead>
            <tbody>
              {stressScenarios.map((scenario) => (
                <tr key={String(scenario.scenario)} className="border-t border-border-subtle">
                  <td className="px-3 py-2 font-medium text-text-institutional">{fmt(scenario.scenario)}</td>
                  <td className={scenario.status === "target_before_breach" ? "px-3 py-2 font-semibold text-chart-positive" : scenario.status === "breach_before_target" ? "px-3 py-2 font-semibold text-chart-negative" : "px-3 py-2 text-text-neutral"}>{fmt(scenario.status)}</td>
                  <td className="px-3 py-2 text-text-neutral">{fmtPct(scenario.target_progress_pct)}</td>
                  <td className="px-3 py-2 text-text-neutral">{fmtCurrency(scenario.ending_profit)}</td>
                  <td className="px-3 py-2 text-text-neutral">{fmt(scenario.first_breach_rule ?? "None")}{scenario.first_breach_day ? ` on ${fmt(scenario.first_breach_day)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Evaluation windows" subtitle="Where the same submitted path would have passed or failed under the configured challenge window">
        <div className="grid gap-3 lg:grid-cols-2">
          <WindowList title="Target before breach" empty="No rolling window reached the target before breach." windows={targetWindows} />
          <WindowList title="Breach before target" empty="No rolling window breached before reaching target." windows={breachWindows} />
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Improvement targets" subtitle="How far the current path is from a cleaner pass under the configured rules">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Profit shortfall", fmtCurrency(improvementTargets.profit_shortfall_to_target), "Additional net profit needed to reach the configured target by the end of the submitted path."],
            ["Total drawdown buffer", fmtPct(improvementTargets.total_drawdown_buffer_pct), "Remaining room before the configured total drawdown limit."],
            ["Daily loss buffer", fmtPct(improvementTargets.daily_loss_buffer_pct), "Remaining room before the configured daily loss limit."],
            ["Risk reduction to clear first breach", fmtPct(improvementTargets.risk_reduction_needed_to_clear_first_breach_pct), "Approximate reduction needed for the observed first breach to fall under its rule limit."],
          ].map(([label, value, helper]) => (
            <div key={label} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">{label}</p>
              <p className="mt-2 text-xl font-semibold text-text-institutional">{value}</p>
              <p className="mt-2 text-xs leading-5 text-text-neutral">{helper}</p>
            </div>
          ))}
        </div>
      </WorkspaceCard>

      <ContextFlipCard
        title="Assumptions and next evidence"
        subtitle="Evidence boundaries carried into exports and share rooms"
        panes={[
          { key: "assumptions", label: "Assumptions", items: truthContext.assumptions, empty: "No assumptions were emitted.", tone: "neutral" },
          { key: "limitations", label: "Limitations", items: truthContext.limitations, empty: "No limitations were emitted.", tone: "warning" },
          { key: "recommendations", label: "Recommendations", items: truthContext.recommendations, empty: "No recommendations were emitted.", tone: "positive" },
        ]}
      />
    </AnalysisPageFrame>
  );
}
