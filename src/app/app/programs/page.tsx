import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { listResearchPrograms } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Research Programs",
  description: "Thesis-led research programs for hypotheses, runs, verdicts, memory, and reports.",
};

export default async function ProgramsPage() {
  const session = await requireServerSession();
  const programs = await listResearchPrograms(session.account_id);
  const active = programs.filter((program) => program.status === "active").length;
  const completedRuns = programs.reduce((total, program) => total + program.completed_analysis_count, 0);
  const failedRuns = programs.reduce((total, program) => total + program.failed_analysis_count, 0);

  return (
    <AnalysisPageFrame
      title="Research Programs"
      description="Start from a market thesis, attach existing evidence, and build a durable trail of hypotheses, runs, verdicts, memory, and reports."
    >
      <section className="artifact-surface grid gap-5 rounded-md border border-border-subtle bg-surface-white p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Research pipeline / program library</p>
          <h2 className="font-display mt-2 text-[clamp(1.9rem,4vw,3.5rem)] font-medium leading-none text-text-institutional">
            Every thesis gets a home before it gets a run.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-text-neutral">
            Programs are the core workspace object. Audit imports remain available, but the product path is now thesis to hypothesis, experiment, verdict, memory, and report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link href="/app/programs/new" className={buttonVariants()}>Start Research Program</Link>
          <Link href="/app/new-analysis" className={buttonVariants({ variant: "secondary" })}>Import Existing Evidence</Link>
        </div>
      </section>

      <MetricRow
        metrics={[
          { label: "Programs", value: String(programs.length), helper: "Tenant-scoped workspaces" },
          { label: "Active", value: String(active), helper: "Open research loops" },
          { label: "Completed Imports", value: String(completedRuns), tone: completedRuns > 0 ? "positive" : "neutral", helper: "Attached completed analyses" },
          { label: "Failed Runs", value: String(failedRuns), tone: failedRuns > 0 ? "warning" : "neutral", helper: "Needs rescue or review" },
        ]}
      />

      {programs.length === 0 ? (
        <EmptyState
          title="No research programs yet"
          body="Open a program for a strategy thesis, then attach an existing analysis or import evidence as the first audit object."
          cta={{ label: "Start Research Program", href: "/app/programs/new" }}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {programs.map((program) => (
            <WorkspaceCard
              key={program.program_id}
              title={program.title}
              subtitle={program.thesis}
              toolbar={<Link href={`/app/programs/${program.program_id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Program</Link>}
              note={`Next action: ${program.next_action}`}
            >
              <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-3">
                <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">Evidence</p>
                  <p className="mt-1 text-lg font-semibold text-text-institutional">{program.attached_analysis_count}</p>
                </div>
                <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">Hypotheses</p>
                  <p className="mt-1 text-lg font-semibold text-text-institutional">{program.active_hypothesis_count}</p>
                </div>
                <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">Last run</p>
                  <p className="mt-1 text-sm font-medium text-text-institutional">{program.last_run_at ? program.last_run_at.slice(0, 10) : "None yet"}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-neutral">
                {program.market ? <span className="rounded-sm border border-border-subtle px-2 py-1">{program.market}</span> : null}
                {program.asset_universe ? <span className="rounded-sm border border-border-subtle px-2 py-1">{program.asset_universe}</span> : null}
                {program.timeframe ? <span className="rounded-sm border border-border-subtle px-2 py-1">{program.timeframe}</span> : null}
              </div>
            </WorkspaceCard>
          ))}
        </div>
      )}
    </AnalysisPageFrame>
  );
}
