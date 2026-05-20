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
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value).replace(/_/g, " ");
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
      requiredPlan: "Professional",
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

  const prop = record.diagnostics.prop_evaluation_readiness;
  const workbench = buildAnalystWorkbenchModel(record, "prop_evaluation_readiness", { benchmark: analysis.benchmark });
  const truthContext = buildTruthContext(record, "prop_evaluation_readiness", { benchmark: analysis.benchmark });
  const metrics = metricsFromScoreBands(prop.metrics);
  const ruleSnapshot = prop.rule_snapshot ?? {};
  const firstBreach = prop.first_breach ?? undefined;

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
          <MetricRow metrics={metrics} cols={3} />
        </WorkspaceCard>

        <WorkspaceCard title="Edit rules" subtitle="Replace fallback assumptions with the actual evaluation rules">
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
                    <td className="px-3 py-2 text-text-neutral">{fmt(row.status)}</td>
                    <td className="px-3 py-2 text-text-neutral">{fmt(row.observed)}</td>
                    <td className="px-3 py-2 text-text-neutral">{fmt(row.allowed)}</td>
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
                      <dd className="font-medium text-text-institutional">{fmt(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Target progress</p>
              <dl className="mt-2 grid gap-2 md:grid-cols-2">
                {Object.entries(prop.target_progress ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-text-neutral">{fmt(key)}</dt>
                    <dd className="font-medium text-text-institutional">{fmt(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </WorkspaceCard>
      </div>

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
