import Link from "next/link";
import type { Metadata } from "next";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { accountService } from "@/lib/server/accounts/service";
import { requireServerSession } from "@/lib/server/auth/session";
import { listAnalyses } from "@/lib/server/services/analysis-service";
import { listResearchPrograms } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Authenticated research pipeline workspace.",
};

export default async function AppHomePage() {
  const session = await requireServerSession();
  const usage = await accountService.getUsage(session.account_id);
  const analyses = await listAnalyses(session.account_id);
  const programs = await listResearchPrograms(session.account_id);

  const completed = analyses.filter((item) => item.status === "completed").length;
  const processing = analyses.filter((item) => item.status === "processing" || item.status === "queued").length;
  const latestCompleted = analyses.find((item) => item.status === "completed");

  return (
    <AnalysisPageFrame
      title="Research Workspace"
      description="A command surface for turning market intuition into research programs, falsification runs, durable memory, and validation artifacts."
    >
      <section className="artifact-surface overflow-hidden rounded-md border border-border-subtle bg-surface-white shadow-sm">
        <div className="grid gap-5 bg-surface-subtle px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Current operating picture</p>
            <h2 className="font-display mt-2 text-[clamp(2rem,5vw,4rem)] font-medium leading-none text-text-institutional">
              {programs[0]?.title ?? latestCompleted?.strategy_name ?? "Research pipeline"}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-text-neutral">
              This workspace is organized around research programs first. Upload audits remain available as imported evidence, but the durable product loop is thesis, hypothesis, experiment, verdict, memory, and report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link href="/app/programs/new" className={buttonVariants()}>Start Program</Link>
            <Link href="/app/new-analysis" className={buttonVariants({ variant: "secondary" })}>Import Evidence</Link>
            {latestCompleted ? (
              <Link href={`/app/analyses/${latestCompleted.analysis_id}/report`} className={buttonVariants({ variant: "tertiary" })}>Open latest report</Link>
            ) : null}
          </div>
        </div>
      </section>

      <MetricRow
        metrics={[
          { label: "Programs", value: String(programs.length), helper: "Active research containers" },
          { label: "Audit Imports", value: String(analyses.length), helper: "Uploaded analyses" },
          { label: "Completed", value: String(completed), tone: completed > 0 ? "positive" : "neutral", helper: "Persisted results" },
          { label: "In Progress", value: String(processing), helper: "Queued + processing" },
        ]}
      />

      <WorkspaceCard title="Monthly activity" subtitle="Current calendar month">
        <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-3">
          <p><span className="font-medium text-text-graphite">Analyses this month:</span> {usage.analyses_created}</p>
          <p><span className="font-medium text-text-graphite">Report exports:</span> {usage.report_exports}</p>
          <p><span className="font-medium text-text-graphite">Artifacts uploaded:</span> {usage.artifacts_uploaded}</p>
        </div>
      </WorkspaceCard>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <WorkspaceCard title="Research flow" subtitle="The product path from thesis to evidence-backed decision" note="Approach A upload audits now operate as import mode inside the larger research pipeline.">
          <div className="grid gap-3 text-sm text-text-neutral md:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
              <p className="font-medium text-text-institutional">1. Start a program</p>
              <p className="mt-1 leading-6">Create the thesis container before chasing runs.</p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
              <p className="font-medium text-text-institutional">2. Import evidence</p>
              <p className="mt-1 leading-6">Attach uploads as audit evidence when useful.</p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
              <p className="font-medium text-text-institutional">3. Build experiments</p>
              <p className="mt-1 leading-6">Upcoming phases add hypothesis specs and queue runs.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/programs/new" className={buttonVariants({ size: "sm" })}>Start Program</Link>
            <Link href="/app/new-analysis" className={buttonVariants({ size: "sm", variant: "secondary" })}>Import Evidence</Link>
            {latestCompleted ? (
              <Link href={`/app/analyses/${latestCompleted.analysis_id}/overview`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Latest Completed</Link>
            ) : (
              <span className={buttonVariants({ size: "sm", variant: "secondary" })}>No completed analyses yet</span>
            )}
            <Link href="/methodology" className={buttonVariants({ size: "sm", variant: "tertiary" })}>Methodology</Link>
          </div>
        </WorkspaceCard>

        <WorkspaceCard title="Recent audit imports" subtitle="Latest validation workbenches">
          {analyses.length === 0 ? (
            <EmptyState
              title="No audit imports yet"
              body="Start a program first, or import existing evidence if you already have a trade history to audit."
              cta={{ label: "Start Program", href: "/app/programs/new" }}
            />
          ) : (
            <AnalysisTable analyses={analyses.slice(0, 5)} />
          )}
        </WorkspaceCard>
      </div>
    </AnalysisPageFrame>
  );
}
