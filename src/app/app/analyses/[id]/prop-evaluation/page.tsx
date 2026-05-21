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
  if (/pct|drawdown|loss|target|consistency/.test(rule)) return fmtPct(value);
  if (/profit|pnl|equity/.test(rule)) return fmtCurrency(value);
  return fmt(value);
}

function recordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function WindowList({ title, empty, windows }: { title: string; empty: string; windows: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-panel/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-institutional">{title}</p>
        <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-neutral">{windows.length}</span>
      </div>
      {windows.length ? (
        <div className="mt-3 space-y-2">
          {windows.slice(0, 6).map((window, index) => (
            <div key={`${window.start_day}-${window.end_day}-${index}`} className="rounded-sm bg-surface-white p-3 text-sm">
              <p className="font-medium text-text-institutional">{fmt(window.start_day)} to {fmt(window.end_day)}</p>
              <p className="mt-1 text-xs text-text-neutral">
                {fmt(window.trading_days)} trading day(s), profit {fmtCurrency(window.profit)} ({fmtPct(window.profit_pct)}).
              </p>
              <p className="mt-1 text-xs text-text-neutral">
                Max daily loss {fmtPct(window.max_daily_loss_pct)}; max total drawdown {fmtPct(window.max_total_drawdown_pct)}.
              </p>
              {window.breach_rule ? (
                <p className="mt-1 text-xs text-chart-negative">Breach: {fmt(window.breach_rule)} on {fmt(window.breach_day)}.</p>
              ) : window.target_hit_day ? (
                <p className="mt-1 text-xs text-chart-positive">Target hit on {fmt(window.target_hit_day)}.</p>
              ) : null}
            </div>
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
  const breachEvents = recordList(metadata.breach_events);
  const targetProgress = prop.target_progress ?? {};
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <WorkspaceCard title="Readiness metrics" subtitle="Pass target, drawdown room, daily-loss pressure, and trading-day coverage">
          <MetricRow metrics={metrics} cols={2} />
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
                {Object.entries(targetProgress).filter(([, value]) => !value || typeof value !== "object").map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-text-neutral">{fmt(key)}</dt>
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

      <WorkspaceCard title="Evaluation windows" subtitle="Where the same submitted path would have passed or failed under the configured challenge window">
        <div className="grid gap-3 lg:grid-cols-2">
          <WindowList title="Target before breach" empty="No rolling window reached the target before breach." windows={targetWindows} />
          <WindowList title="Breach before target" empty="No rolling window breached before reaching target." windows={breachWindows} />
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
