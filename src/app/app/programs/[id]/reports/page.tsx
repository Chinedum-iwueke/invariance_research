import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  createProgramReportShare,
  createProgramReportSnapshot,
  requestProgramResearchDeskReview,
} from "@/lib/server/research-programs/program-report-service";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";
import { buildProgramWorkbenchSummary } from "@/lib/server/research-programs/workbench";

export const metadata: Metadata = {
  title: "Program Reports",
  description: "Program report readiness and snapshots.",
};

export default async function ProgramReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();
  const summary = buildProgramWorkbenchSummary(detail);

  async function generateReportAction() {
    "use server";
    const activeSession = await requireServerSession();
    await createProgramReportSnapshot({ program_id: id, account_id: activeSession.account_id, user_id: activeSession.user_id });
    revalidatePath(`/app/programs/${id}/reports`);
    revalidatePath(`/app/programs/${id}`);
    redirect(`/app/programs/${id}/reports`);
  }

  async function shareReportAction(formData: FormData) {
    "use server";
    const activeSession = await requireServerSession();
    const reportId = String(formData.get("report_id") ?? "");
    const created = await createProgramReportShare({
      program_report_snapshot_id: reportId,
      account_id: activeSession.account_id,
      user_id: activeSession.user_id,
    });
    redirect(created.url);
  }

  async function researchDeskAction(formData: FormData) {
    "use server";
    const activeSession = await requireServerSession();
    const reportId = String(formData.get("report_id") ?? "");
    await requestProgramResearchDeskReview({
      program_report_snapshot_id: reportId,
      account_id: activeSession.account_id,
      requested_by_user_id: activeSession.user_id,
      user_note: "Program-level Research Desk review requested from the research program report page.",
    });
    revalidatePath(`/app/programs/${id}/reports`);
    redirect(`/app/programs/${id}/reports`);
  }

  return (
    <AnalysisPageFrame title={`${detail.program.title} Reports`} description="Program-level proof artifacts and report readiness assembled from verdicts, memory, and imported evidence.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
        <Link href={`/app/programs/${id}/runs`} className={buttonVariants({ size: "sm", variant: "tertiary" })}>Review Runs</Link>
      </div>

      <WorkspaceCard title="Report readiness" subtitle="Freeze the reasoning path into a program milestone: research question, hypotheses, experiments, rejected variants, surviving candidates, limits, and next tests.">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Latest verdict</p>
            <p className="mt-2 text-sm font-medium text-text-institutional">{summary.latest_verdict?.verdict?.replace(/_/g, " ") ?? "not recorded"}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Completed runs</p>
            <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.completed_experiments}</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Memory findings</p>
            <p className="mt-2 text-2xl font-medium text-text-institutional">{summary.findings}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-text-neutral">
          A program report should cite an approved hypothesis, an approved strategy spec, at least one completed experiment run, and the memory-backed limitations or next actions that keep the conclusion defensible.
        </p>
        <form action={generateReportAction} className="mt-4">
          <Button type="submit" size="sm" disabled={!summary.command_states.can_generate_report}>Generate Program Report</Button>
        </form>
      </WorkspaceCard>

      <WorkspaceCard title="Report snapshots" subtitle="Persisted program report records attached to this research program.">
        {detail.reports.length === 0 ? (
          <EmptyState
            title="No program report snapshots yet"
            body="Complete at least one experiment run or attach audit evidence, then generate a program report milestone."
            cta={{ label: "Open Runs", href: `/app/programs/${id}/runs` }}
          />
        ) : (
          <div className="space-y-3">
            {detail.reports.map((report) => (
              <div key={report.program_report_snapshot_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-text-institutional">{report.title}</h2>
                  <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{report.status}</span>
                </div>
                <p className="mt-2 text-xs text-text-neutral">Created {report.created_at}</p>
                {report.report_snapshot_id ? <p className="mt-2 text-xs text-text-neutral">Snapshot {report.report_snapshot_id.slice(0, 8)}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/api/programs/${id}/reports/${report.program_report_snapshot_id}/download?format=md`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Download MD</Link>
                  <Link href={`/api/programs/${id}/reports/${report.program_report_snapshot_id}/download?format=json`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Download JSON</Link>
                  <form action={shareReportAction}>
                    <input type="hidden" name="report_id" value={report.program_report_snapshot_id} />
                    <Button type="submit" size="sm" variant="tertiary" disabled={report.status !== "active"}>Open Share Room</Button>
                  </form>
                  <form action={researchDeskAction}>
                    <input type="hidden" name="report_id" value={report.program_report_snapshot_id} />
                    <Button type="submit" size="sm" variant="tertiary" disabled={report.status !== "active" || !report.report_snapshot_id}>Request Expert Review</Button>
                  </form>
                </div>
                {!report.report_snapshot_id ? (
                  <p className="mt-3 text-xs leading-5 text-text-neutral">Research Desk handoff requires one completed audit import as a backing immutable report snapshot.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
