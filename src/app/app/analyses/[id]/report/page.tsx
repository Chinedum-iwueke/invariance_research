import Link from "next/link";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { InterpretationBlock } from "@/components/dashboard/interpretation-block";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { VerdictCard } from "@/components/dashboard/verdict-card";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { isReportExportPlanRestricted } from "@/lib/app/upgrade-visibility";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { getAnalysisRecord, reportSections, toInterpretationBlockPayload } from "@/lib/mock/analysis";

export default async function ReportPage() {
  const session = await requireServerSession();
  const state = accountService.getAccountState(session.account_id);
  const analysis = getAnalysisRecord("alpha-trend-v2");
  const canExport = state?.entitlements.can_export_report ?? false;
  const canViewFull = state?.entitlements.can_view_full_report ?? false;

  return (
    <AnalysisPageFrame
      title="Validation Report"
      description="Structured deliverable summarizing strategy robustness, risk posture, and deployment guidance."
    >
      <WorkspaceCard title="Report Header" subtitle="Research artifact metadata">
        <div className="grid gap-2 text-sm text-text-neutral md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-text-graphite">Strategy:</span> {analysis.strategy.strategy_name}</p>
          <p><span className="font-medium text-text-graphite">Date:</span> {analysis.report.generated_at ?? analysis.updated_at}</p>
          <p><span className="font-medium text-text-graphite">Scope:</span> {canViewFull ? "Full diagnostic suite" : "Limited report scope"}</p>
          <p><span className="font-medium text-text-graphite">Asset:</span> {analysis.dataset.market}</p>
        </div>
      </WorkspaceCard>

      {!canViewFull ? (
        <UpgradePanel
          title="Full report depth is plan-gated"
          explanation="Your current plan includes a limited report view. Upgrade when you need expanded diagnostic sections and complete exportable reporting."
          planHint="Full report view and exports are available on Professional and above."
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard title="Executive Summary" subtitle="Institutional snapshot">
          <p className="text-sm leading-relaxed text-text-neutral">{analysis.report.executive_summary}</p>
        </WorkspaceCard>
        <VerdictCard
          title={analysis.summary.headline_verdict.title}
          summary={analysis.summary.headline_verdict.summary}
          posture={analysis.summary.headline_verdict.status}
        />
      </div>

      <WorkspaceCard title="Diagnostics Summary" subtitle="Quick access to supporting diagnostics">
        <div className="grid gap-2 md:grid-cols-2">
          {reportSections.map((section) => (
            <Link key={section.title} href={section.href} className="rounded-sm border p-3 text-sm text-text-graphite hover:bg-surface-panel">
              {section.title}
            </Link>
          ))}
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Methodology Assumptions" subtitle="Execution and stress model context">
        <ul className="space-y-2 text-sm text-text-neutral">
          {analysis.report.methodology_assumptions.map((assumption) => (
            <li key={assumption}>• {assumption}</li>
          ))}
        </ul>
      </WorkspaceCard>

      <InterpretationBlock
        {...toInterpretationBlockPayload({
          title: "Final Recommendations",
          summary: "Proceed with constrained capital allocation and explicit monitoring gates.",
          bullets: analysis.report.recommendations,
        })}
      />

      <WorkspaceCard title="Export & Share" subtitle="Report artifact actions">
        <div className="flex flex-wrap gap-2">
          {!isReportExportPlanRestricted(canExport) ? (
            <button className={buttonVariants({ variant: "secondary" })}>Export Report (placeholder)</button>
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
          <button className={buttonVariants({ variant: "secondary" })}>Share Link (placeholder)</button>
          <Link href="/contact" className={buttonVariants()}>
            Need an independent validation audit?
          </Link>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
