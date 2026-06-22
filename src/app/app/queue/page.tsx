import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { listExperimentJobsForAccount, listResearchPrograms } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Experiment Queue",
  description: "Research experiment queue.",
};

export default async function ExperimentQueuePage() {
  const session = await requireServerSession();
  const [jobs, programs] = await Promise.all([
    listExperimentJobsForAccount(session.account_id),
    listResearchPrograms(session.account_id),
  ]);
  const queued = jobs.filter((job) => job.status === "queued");
  const paused = jobs.filter((job) => job.status === "paused");
  const processing = jobs.filter((job) => job.status === "processing");
  const failed = jobs.filter((job) => job.status === "failed");

  return (
    <AnalysisPageFrame
      title="Experiment Queue"
      description="Approved falsification jobs for Research Programs. The experiment worker executes approved contracts and stores auditable artifacts."
    >
      <MetricRow
        metrics={[
          { label: "Queued", value: String(queued.length), tone: queued.length ? "positive" : "neutral", helper: "Waiting for execution" },
          { label: "Processing", value: String(processing.length), tone: processing.length ? "positive" : "neutral", helper: "Experiment worker-owned" },
          { label: "Paused", value: String(paused.length), tone: paused.length ? "warning" : "neutral", helper: "User-held jobs" },
          { label: "Failed", value: String(failed.length), tone: failed.length ? "warning" : "neutral", helper: "Retry candidates" },
        ]}
      />

      <WorkspaceCard title="Queue controls" subtitle="Jobs are prioritized, retryable, account-scoped, and processed by the external experiment worker.">
        {jobs.length === 0 ? (
          <EmptyState
            title="No experiment jobs queued"
            body="Create a Research Program, approve a hypothesis, approve a strategy spec, then generate and queue a falsification plan."
            cta={{ label: "Open Research Programs", href: "/app/programs" }}
          />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const program = programs.find((item) => item.program_id === job.program_id);
              return (
                <div key={job.experiment_job_id} className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{job.status}</span>
                      <p className="font-medium text-text-institutional">{program?.title ?? "Research program"}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-neutral">{job.current_step}</p>
                    <p className="mt-1 text-xs text-text-neutral">priority {job.priority} · retry {job.retry_count}/{job.max_attempts} · available {job.available_at}</p>
                  </div>
                  <Link href={`/app/programs/${job.program_id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Program</Link>
                </div>
              );
            })}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
