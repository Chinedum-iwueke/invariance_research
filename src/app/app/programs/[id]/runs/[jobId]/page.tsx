import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Program Run Detail",
  description: "Experiment run event timeline and artifact summary.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function valueText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "not recorded";
  return JSON.stringify(value);
}

export default async function ProgramRunDetailPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  const job = detail.experiment_jobs.find((candidate) => candidate.experiment_job_id === jobId);
  if (!job) notFound();

  const events = detail.experiment_job_events.filter((event) => event.experiment_job_id === jobId);
  const completedEvent = events.find((event) => event.event_type === "completed");
  const cardSummary = asRecord(asRecord(completedEvent?.payload).card_summary);
  const artifactSummary = asRecord(asRecord(completedEvent?.payload).artifact_summary);

  return (
    <AnalysisPageFrame title={`Run ${job.experiment_job_id.slice(0, 8)}`} description={`Status: ${job.status}. ${job.current_step}`}>
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}/runs`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Runs</Link>
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "tertiary" })}>Program Overview</Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <WorkspaceCard title="Run state" subtitle="Operational state for this exact experiment job.">
          <div className="grid gap-3 text-sm text-text-neutral">
            {[
              ["Status", job.status],
              ["Progress", `${job.progress_pct}%`],
              ["Current step", job.current_step],
              ["Attempts", `${job.retry_count}/${job.max_attempts}`],
              ["Created", job.created_at],
              ["Started", job.started_at ?? "not started"],
              ["Finished", job.finished_at ?? "not finished"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2">
                <span>{label}</span>
                <span className="text-right font-medium text-text-institutional">{value}</span>
              </div>
            ))}
            {job.last_error ? <p className="rounded-md border border-state-danger/30 bg-state-danger/10 p-3 text-state-danger">{job.last_error}</p> : null}
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="Verdict packet" subtitle="Terminal-grade intelligence recorded by the engine output contract.">
          {Object.keys(cardSummary).length === 0 ? (
            <p className="text-sm leading-6 text-text-neutral">No completed verdict packet has been recorded for this run yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(cardSummary).map(([key, value]) => (
                <div key={key} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{key.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm font-medium text-text-institutional">{valueText(value)}</p>
                </div>
              ))}
            </div>
          )}
        </WorkspaceCard>
      </div>

      <WorkspaceCard title="Artifacts" subtitle="Persisted paths and files emitted by the experiment executor.">
        {Object.keys(artifactSummary).length === 0 ? (
          <p className="text-sm leading-6 text-text-neutral">No artifact summary has been recorded yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(artifactSummary).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{key.replace(/_/g, " ")}</p>
                <p className="mt-2 break-words text-sm text-text-institutional">{valueText(value)}</p>
              </div>
            ))}
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Event timeline" subtitle="Claim, completion, failure, retry, and worker events for the run.">
        {events.length === 0 ? (
          <p className="text-sm leading-6 text-text-neutral">No events have been recorded for this run.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.experiment_job_event_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-institutional">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{event.created_at}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">{event.message}</p>
              </div>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
