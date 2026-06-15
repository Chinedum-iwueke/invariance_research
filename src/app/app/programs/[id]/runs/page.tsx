import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";
import type { ExperimentJobEventRecord } from "@/lib/server/research-programs/models";

export const metadata: Metadata = {
  title: "Program Runs",
  description: "Experiment run queue and terminal results for a research program.",
};

function latestEventForJob(events: ExperimentJobEventRecord[], jobId: string) {
  return events.find((event) => event.experiment_job_id === jobId);
}

function statusTone(status: string) {
  if (status === "completed") return "border-state-success/30 bg-state-success/10 text-state-success";
  if (status === "failed") return "border-state-danger/30 bg-state-danger/10 text-state-danger";
  if (status === "processing" || status === "queued") return "border-brand/30 bg-brand/10 text-brand";
  return "border-border-subtle bg-surface-subtle text-text-neutral";
}

export default async function ProgramRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  return (
    <AnalysisPageFrame title={`${detail.program.title} Runs`} description="Queue state, run progress, result events, and failure explanations for this research program.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
        <Link href={`/app/programs/${id}/experiments`} className={buttonVariants({ size: "sm", variant: "tertiary" })}>Experiment Plans</Link>
      </div>

      <WorkspaceCard title="Experiment queue" subtitle="Every queued, running, completed, and failed experiment job attached to this program.">
        {detail.experiment_jobs.length === 0 ? (
          <EmptyState
            title="No experiment jobs yet"
            body="Approve a strategy spec and queue an experiment plan before run records appear here."
            cta={{ label: "Open Hypothesis Approval", href: `/app/programs/${id}#hypothesis-approval` }}
          />
        ) : (
          <div className="space-y-3">
            {detail.experiment_jobs.map((job) => {
              const latestEvent = latestEventForJob(detail.experiment_job_events, job.experiment_job_id);
              return (
                <Link
                  key={job.experiment_job_id}
                  href={`/app/programs/${id}/runs/${job.experiment_job_id}`}
                  className="grid gap-3 rounded-md border border-border-subtle bg-surface-white p-4 transition hover:border-brand/40 hover:bg-surface-subtle lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-text-institutional">Run {job.experiment_job_id.slice(0, 8)}</h2>
                      <span className={`rounded-sm border px-2 py-1 text-[11px] uppercase tracking-[0.1em] ${statusTone(job.status)}`}>{job.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-neutral">{latestEvent?.message ?? job.current_step}</p>
                    {job.last_error ? <p className="mt-2 text-xs leading-5 text-state-danger">{job.last_error}</p> : null}
                  </div>
                  <div className="grid min-w-48 grid-cols-2 gap-2 text-xs text-text-neutral">
                    <span>Progress</span><span className="text-right font-medium text-text-institutional">{job.progress_pct}%</span>
                    <span>Attempts</span><span className="text-right font-medium text-text-institutional">{job.retry_count}/{job.max_attempts}</span>
                    <span>Updated</span><span className="text-right font-medium text-text-institutional">{job.updated_at.slice(0, 10)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
