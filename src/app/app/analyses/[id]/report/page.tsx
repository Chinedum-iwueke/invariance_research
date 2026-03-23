import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { toInterpretationBlockPayload } from "@/lib/app/analysis-ui";
import { isReportExportPlanRestricted } from "@/lib/app/upgrade-visibility";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const isAdmin = isAdminIdentity({ user_id: session.user_id, email: session.email });
  const state = accountService.getAccountState(session.account_id);
  const { id } = await params;
  const { analysis, record } = requireOwnedAnalysisView(id, session.account_id);
  const canExport = isAdmin || (state?.entitlements.can_export_report ?? false);
  const canViewFull = isAdmin || (state?.entitlements.can_view_full_report ?? false);

  if (!record) {
    return (
      <AnalysisPageFrame title="Validation Report" description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance.">
        <AnalysisRunState analysis={analysis} />
      </AnalysisPageFrame>
    );
  }

  return (
    <AnalysisPageFrame title="Validation Report" description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance.">
      <WorkspaceCard title="Report Header" subtitle="Research artifact metadata">
        <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-text-graphite">Strategy:</span> {record.strategy.strategy_name}</p>
          <p><span className="font-medium text-text-graphite">Date:</span> {record.report.generated_at ?? record.updated_at}</p>
          <p><span className="font-medium text-text-graphite">Scope:</span> {canViewFull ? "Full diagnostic suite" : "Limited report scope"}</p>
          <p><span className="font-medium text-text-graphite">Asset:</span> {record.dataset.market ?? "N/A"}</p>
        </div>
      </WorkspaceCard>

      {!canViewFull ? (
        <UpgradePanel
          title="Full report depth is plan-gated"
          explanation="Your current plan includes a limited report view. Upgrade when you need expanded diagnostic sections and complete exportable reporting."
          planHint="Full report view and exports are available on Professional and above."
        />
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <WorkspaceCard title="Executive Summary" subtitle="Institutional snapshot">
          <p className="text-sm leading-relaxed text-text-neutral">{record.report.executive_summary}</p>
        </WorkspaceCard>
        <VerdictCard title={record.summary.headline_verdict.title} summary={record.summary.headline_verdict.summary} posture={record.summary.headline_verdict.status} />
      </div>

      <WorkspaceCard title="Diagnostics Summary" subtitle="Quick access to supporting diagnostics">
        <ul className="space-y-2 text-sm text-text-neutral">
          {record.report.diagnostics_summary.map((entry) => (<li key={entry}>• {entry}</li>))}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="Methodology Assumptions" subtitle="Execution and stress model context">
        <ul className="space-y-2 text-sm text-text-neutral">
          {record.report.methodology_assumptions.map((assumption) => (<li key={assumption}>• {assumption}</li>))}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard title="Limitations" subtitle="Honest boundaries from engine-native diagnostics">
        <ul className="space-y-2 text-sm text-text-neutral">
          {record.engine_payload.report_sections.limitations.length === 0 ? (
            <li>• No explicit report limitations were emitted.</li>
          ) : (
            record.engine_payload.report_sections.limitations.map((item) => <li key={item}>• {item}</li>)
          )}
        </ul>
      </WorkspaceCard>

      <InterpretationBlock {...toInterpretationBlockPayload({ title: "Final Recommendations", summary: "Actions persisted in the run report payload.", bullets: record.report.recommendations })} />

      <WorkspaceCard title="Export & Share" subtitle="Report artifact actions">
        <div className="flex flex-wrap gap-2">
          {!isReportExportPlanRestricted(canExport) ? (
            <span className={buttonVariants({ variant: "secondary" })}>Export endpoint wiring in progress</span>
          ) : (
            <DiagnosticLockPanel
              model={buildDiagnosticLockModel({
                state: "plan_locked",
                diagnosticTitle: "Report Export",
                diagnosticPurpose: "Generate an external report artifact for audit sharing and governance records.",
                currentPlan: state?.account.plan_id,
                requiredPlan: "Professional",
              })}
            />
          )}
          <Link href={`/api/analyses/${record.analysis_id}`} className={buttonVariants({ variant: "secondary" })}>View raw analysis payload</Link>
          <Link href="/contact" className={buttonVariants()}>
            Need an independent validation audit?
          </Link>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
