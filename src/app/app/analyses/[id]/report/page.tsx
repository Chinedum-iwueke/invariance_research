import Link from "next/link";
import { AlertTriangle, BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisRunState } from "@/components/dashboard/analysis-run-state";
import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import { MetricRow } from "@/components/dashboard/metric-row";
import { ReportExportActions } from "@/components/dashboard/report-export-actions";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logAnalysisPageDebug } from "@/lib/app/analysis-page-debug";
import { buildReportViewModel } from "@/lib/app/report-view";
import { metricsFromScoreBands } from "@/lib/app/analysis-ui";
import { accountService } from "@/lib/server/accounts/service";
import { isAdminIdentity } from "@/lib/server/admin/guards";
import { requireServerSession } from "@/lib/server/auth/session";
import { requireOwnedAnalysisView } from "@/lib/server/services/analysis-view-service";

function VerdictBanner({ headline, summary, statusLabel, posture }: { headline: string; summary: string; statusLabel: string; posture: "robust" | "moderate" | "fragile" }) {
  const Icon = posture === "robust" ? ShieldCheck : posture === "moderate" ? BadgeCheck : ShieldAlert;

  return (
    <section
      className={cn(
        "rounded-md border px-6 py-5",
        posture === "robust" && "border-chart-positive/30 bg-chart-positive/10",
        posture === "moderate" && "border-brand/30 bg-brand/10",
        posture === "fragile" && "border-chart-negative/30 bg-chart-negative/10",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-graphite">Executive verdict</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-institutional">{headline}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-neutral">{summary}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-text-institutional/15 bg-surface-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-institutional">
          <Icon className="h-4 w-4" />
          {statusLabel}
        </div>
      </div>
    </section>
  );
}

function ConfidencePanel({ level, value, explanation }: { level: string; value?: string; explanation: string }) {
  return (
    <WorkspaceCard title="Confidence Level" subtitle="Trust weighting given artifact richness and diagnostic completeness">
      <div className="space-y-2">
        <p className="text-xl font-semibold tracking-tight text-text-institutional">{level}{value ? ` (${value})` : ""}</p>
        <p className="text-sm leading-relaxed text-text-neutral">{explanation}</p>
      </div>
    </WorkspaceCard>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-text-neutral">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-text-neutral">
      {items.map((item) => <li key={item}>• {item}</li>)}
    </ul>
  );
}

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

  const view = buildReportViewModel(record);
  const reportBranch = view.charts.length > 0 ? "native_figures_branch" : "empty_state_branch";
  logAnalysisPageDebug({
    analysis_id: record.analysis_id,
    page: "report",
    input_figure_count: record.report.figures.length,
    input_figure_types: record.report.figures.map((figure) => figure.type),
    singular_figure_present: false,
    fallback_figure_source_available: false,
    selected_figure_count: view.charts.length,
    selected_figure_types: view.charts.map((figure) => figure.type),
    branch: reportBranch,
    empty_state_reason: reportBranch === "empty_state_branch"
      ? "curated chart selection returned no non-empty figures (empty series or de-duplication filtered all candidates)"
      : undefined,
  });

  return (
    <AnalysisPageFrame title="Validation Report" description="Institutional validation deliverable with executive posture, confidence, decision metrics, diagnostic evidence, and exportable reporting.">
      <WorkspaceCard title="Report Header" subtitle="Institutional research artifact metadata">
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

      <VerdictBanner
        headline={view.verdict.headline}
        summary={view.verdict.summary}
        statusLabel={view.verdict.statusLabel}
        posture={view.verdict.posture}
      />

      <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.75fr]">
        <WorkspaceCard title="Executive Summary" subtitle="Conclusive narrative for stakeholder decisioning">
          <p className="text-sm leading-relaxed text-text-neutral">{record.report.executive_summary}</p>
        </WorkspaceCard>
        <ConfidencePanel level={view.confidence.label} value={view.confidence.value} explanation={view.confidence.explanation} />
      </div>

      <WorkspaceCard title="Key Metrics Snapshot" subtitle="Most decision-relevant risk and robustness metrics">
        <MetricRow metrics={metricsFromScoreBands(view.keyMetrics)} cols={6} />
      </WorkspaceCard>

      <WorkspaceCard title="Diagnostic Evidence" subtitle="Curated figures supporting the verdict and deployment posture">
        <div className="grid gap-4 xl:grid-cols-2">
          {view.charts.map((figure) => (
            <FigureCard
              key={figure.figure_id}
              title={figure.title}
              subtitle={figure.subtitle}
              figure={<DiagnosticFigure figure={figure} />}
              note={figure.note}
            />
          ))}
        </div>
        {!view.charts.length ? <p className="mt-2 text-sm text-text-neutral">No curated figure payloads were emitted for this report run.</p> : null}
      </WorkspaceCard>

      <WorkspaceCard title="Diagnostics Summary" subtitle="Synthesis of supporting checks across modules">
        <BulletList items={view.diagnosticsSummary} empty="No diagnostic summary entries were persisted for this run." />
      </WorkspaceCard>

      <WorkspaceCard title="Methodology" subtitle="Execution and stress model assumptions shaping interpretation">
        <BulletList items={view.methodology} empty="No methodology assumptions were emitted." />
      </WorkspaceCard>

      <WorkspaceCard title="Limitations" subtitle="Known boundaries, missing dimensions, and uncertainty sources">
        <BulletList items={view.limitations} empty="No explicit report limitations were emitted." />
      </WorkspaceCard>

      <WorkspaceCard title="Deployment Guidance" subtitle="Commercial deployment posture and gating conditions">
        <div className="space-y-4">
          <div className={cn("rounded-md border px-4 py-3", view.deploymentGuidance.advisable ? "border-chart-positive/25 bg-chart-positive/10" : "border-chart-negative/25 bg-chart-negative/10")}>
            <p className="text-sm font-semibold text-text-institutional">{view.deploymentGuidance.advisoryLabel}</p>
            <p className="mt-1 text-sm text-text-neutral">{view.deploymentGuidance.summary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Appropriate usage</p>
              <BulletList items={view.deploymentGuidance.suitableContexts} empty="No specific favorable context was emitted in this run." />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Conditions before deployment</p>
              <BulletList items={view.deploymentGuidance.requiredConditions} empty="No explicit pre-deployment conditions were emitted." />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-graphite">Deployment blockers</p>
              <BulletList items={view.deploymentGuidance.blockers} empty="No hard blockers were explicitly emitted, but continue governance review." />
            </div>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Final Recommendations" subtitle="Action-oriented recommendations carried from report payload">
        <BulletList items={view.recommendations} empty="No recommendations were emitted." />
      </WorkspaceCard>

      <WorkspaceCard title="Export & Share" subtitle="Client-ready PDF artifact and raw payload access">
        <ReportExportActions analysisId={record.analysis_id} canExport={canExport} currentPlan={state?.account.plan_id} />
        <div className="mt-4 border-t pt-3">
          <p className="text-xs text-text-neutral">Polished PDF export is the primary client deliverable. Raw payload access remains available for audit transparency and downstream analyst workflows.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/contact" className={buttonVariants()}>
              Need an independent validation audit?
            </Link>
            <span className="inline-flex items-center gap-1 text-xs text-text-neutral"><AlertTriangle className="h-3.5 w-3.5" /> Export links expire automatically based on retention policy.</span>
          </div>
        </div>
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
