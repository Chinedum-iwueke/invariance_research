import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisStatusBadge } from "@/components/dashboard/analysis-status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricRow } from "@/components/dashboard/metric-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ResearchCopilot } from "@/components/research-programs/research-copilot";
import { HypothesisCardBridge } from "@/components/research-programs/hypothesis-card-bridge";
import { QualificationPinePanel } from "@/components/research-programs/qualification-pine-panel";
import { DeploymentCommandCenter } from "@/components/research-programs/deployment-command-center";
import { TradeMemoryPanel } from "@/components/research-programs/trade-memory-panel";
import { ExecutionCommandSurface } from "@/components/research-programs/execution-command-surface";
import { ExperimentVerdictCards } from "@/components/research-programs/experiment-verdict-cards";
import { ProgramWorkbenchOverview } from "@/components/research-programs/program-workbench-overview";
import { ResearchMemoryPanel } from "@/components/research-programs/research-memory-panel";
import { SpecApprovalPanel } from "@/components/research-programs/spec-approval-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import {
  attachAnalysisToResearchProgram,
  getResearchProgramDetail,
  listAttachableAnalysesForProgram,
} from "@/lib/server/research-programs/service";
import { buildProgramWorkbenchSummary } from "@/lib/server/research-programs/workbench";
import { getProgramConversationDetail } from "@/lib/server/research-copilot/service";
import { getResearchSpecBridgeDetail } from "@/lib/server/research-specs-v2/service";
import {
  getC2Detail,
  syncProgramArtifactCatalog,
} from "@/lib/server/research-c2/service";
import { getC3Detail } from "@/lib/server/research-c3/service";
import { getC4Detail } from "@/lib/server/research-c4/service";
import { getExecutionSafetyDetail } from "@/lib/server/research-execution/service";

export const metadata: Metadata = {
  title: "Research Program",
  description: "Research program timeline and attached evidence.",
};

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();
  const attachableAnalyses = await listAttachableAnalysesForProgram(
    id,
    session.account_id,
  );
  const conversationDetail = await getProgramConversationDetail({
    programId: id,
    accountId: session.account_id,
    userId: session.user_id,
  });
  if (!conversationDetail) notFound();
  const specBridgeDetail = await getResearchSpecBridgeDetail(
    id,
    session.account_id,
  );
  let c2Detail = await getC2Detail(id, session.account_id);
  if (!c2Detail.catalog.length) {
    await syncProgramArtifactCatalog(id, session.account_id);
    c2Detail = await getC2Detail(id, session.account_id);
  }
  const c3Detail = await getC3Detail(id, session.account_id);
  const c4Detail = await getC4Detail(id, session.account_id);
  const executionDetail = await getExecutionSafetyDetail(id, session.account_id);

  async function attachAnalysisAction(formData: FormData) {
    "use server";
    const activeSession = await requireServerSession();
    const analysisId = String(formData.get("analysis_id") ?? "");
    if (!analysisId) redirect(`/app/programs/${id}`);
    await attachAnalysisToResearchProgram({
      program_id: id,
      analysis_id: analysisId,
      account_id: activeSession.account_id,
      user_id: activeSession.user_id,
    });
    revalidatePath(`/app/programs/${id}`);
    revalidatePath("/app/programs");
    redirect(`/app/programs/${id}`);
  }

  const { program } = detail;
  const workbenchSummary = buildProgramWorkbenchSummary(detail);

  return (
    <AnalysisPageFrame title={program.title} description={program.thesis}>
      <section className="artifact-surface rounded-md border border-border-subtle bg-surface-white shadow-sm">
        <div className="grid gap-5 bg-surface-subtle px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">
              Research program
            </p>
            <h2 className="font-display mt-2 text-[clamp(2rem,4vw,3.8rem)] font-medium leading-none text-text-institutional">
              {program.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-text-neutral">
              {program.thesis}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-white p-4 text-sm text-text-neutral">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em]">
              Next action
            </p>
            <p className="mt-2 max-w-sm font-medium leading-6 text-text-institutional">
              {program.next_action}
            </p>
          </div>
        </div>
      </section>

      <MetricRow
        metrics={[
          {
            label: "Attached Evidence",
            value: String(program.attached_analysis_count),
            helper: "Analyses linked to this thesis",
          },
          {
            label: "Completed",
            value: String(program.completed_analysis_count),
            tone: program.completed_analysis_count > 0 ? "positive" : "neutral",
            helper: "Completed audit imports",
          },
          {
            label: "Failed",
            value: String(program.failed_analysis_count),
            tone: program.failed_analysis_count > 0 ? "warning" : "neutral",
            helper: "Needs rescue",
          },
          {
            label: "Hypotheses",
            value: String(detail.hypothesis_versions.length),
            helper: "Versioned test protocols",
          },
        ]}
      />

      <WorkspaceCard
        title="Program operating view"
        subtitle="The current thesis state, active queue, latest verdict, memory signal, and next commands in one place."
      >
        <ProgramWorkbenchOverview
          programId={program.program_id}
          summary={workbenchSummary}
        />
      </WorkspaceCard>

      <section aria-label="Research copilot">
        <ResearchCopilot
          programId={program.program_id}
          initialDetail={conversationDetail}
          artifacts={c2Detail.catalog}
        />
      </section>

      <details className="rounded-md border border-border-subtle bg-surface-white px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium text-text-institutional">
          Advanced structured intake
        </summary>
        <p className="mt-3 text-sm leading-6 text-text-neutral">
          The previous form-led intake remains available through the
          clarification API for compatibility while the conversation becomes the
          default research surface.
        </p>
      </details>

      <WorkspaceCard
        title="Hypothesis Card and executable specs"
        subtitle="Confirm the research object, inspect provenance, then classify what the engine can execute without invention."
      >
        <HypothesisCardBridge
          programId={program.program_id}
          initialDetail={specBridgeDetail}
          proposals={conversationDetail.proposals}
        />
      </WorkspaceCard>

      <WorkspaceCard
        title="Qualification, evidence, and TradingView"
        subtitle="Qualify exact backtest evidence, interrogate the program record, and project supported strategies onto TradingView without weakening engine truth."
      >
        <QualificationPinePanel
          programId={program.program_id}
          initialDetail={c2Detail}
          specs={specBridgeDetail}
          experimentJobs={detail.experiment_jobs}
        />
      </WorkspaceCard>

      <WorkspaceCard
        title="Exchange deployment command"
        subtitle="Connect Bybit or Binance spot or perpetual accounts, pin an approved strategy to exact risk controls, then supervise demo or bounded live-canary state from one audited command surface."
      >
        <DeploymentCommandCenter programId={program.program_id} initialDetail={c3Detail} qualifications={c2Detail.qualifications} />
      </WorkspaceCard>

      <WorkspaceCard
        title="Unified trade memory"
        subtitle="Link causal decision state to backtest, demo, and live outcomes; retrieve comparable episodes without treating hindsight or narrative as market evidence."
      >
        <TradeMemoryPanel
          programId={program.program_id}
          initialDetail={c4Detail}
          initialStrategyHash={c2Detail.qualifications.find((item) => item.status === "qualified")?.strategy_spec_hash}
        />
      </WorkspaceCard>

      <WorkspaceCard
        title="Portfolio command"
        subtitle="Monitor durable exchange state, active trade episodes, risk consumption, incidents, promotions, and memory-policy behavior without placing the trading loop inside a web request."
      >
        <ExecutionCommandSurface programId={program.program_id} initialExecution={executionDetail} initialControl={c3Detail} episodes={c4Detail.episodes} decisionSnapshots={c4Detail.snapshots} />
      </WorkspaceCard>

      <div id="hypothesis-approval">
        <WorkspaceCard
          title="Hypothesis and strategy approval"
          subtitle="Turn the research brief into approved, auditable specs before any experiment can enter the queue."
        >
          <SpecApprovalPanel
            programId={program.program_id}
            briefs={detail.research_briefs}
            hypothesisVersions={detail.hypothesis_versions}
            strategySpecs={detail.strategy_specs}
            experimentPlans={detail.experiment_plans}
            experimentJobs={detail.experiment_jobs}
          />
        </WorkspaceCard>
      </div>

      <WorkspaceCard
        title="Verdict cards and result interpreter"
        subtitle="Completed experiment artifacts become a verdict, failure explanation, confidence boundary, and next experiment."
      >
        <ExperimentVerdictCards
          jobs={detail.experiment_jobs}
          events={detail.experiment_job_events}
        />
      </WorkspaceCard>

      <WorkspaceCard
        title="Research memory"
        subtitle="Remember verdicts, failures, findings, next experiments, and similarity signatures inside this account only."
      >
        <ResearchMemoryPanel memory={detail.memory} compact />
      </WorkspaceCard>

      <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
        <WorkspaceCard
          title="Attached evidence"
          subtitle="Existing upload analyses can be attached as audit imports inside the program."
        >
          {detail.analyses.length === 0 ? (
            <EmptyState
              title="No evidence attached"
              body="Attach a completed analysis or import a new artifact as the first evidence object for this thesis."
              cta={{
                label: "Import Existing Evidence",
                href: "/app/new-analysis",
              }}
            />
          ) : (
            <div className="space-y-3">
              {detail.analyses.map((analysis) => (
                <div
                  key={analysis.analysis_id}
                  className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-text-institutional">
                        {analysis.strategy_name}
                      </h3>
                      <AnalysisStatusBadge status={analysis.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-neutral">
                      {analysis.asset} · {analysis.timeframe} ·{" "}
                      {analysis.trade_count} trades · created{" "}
                      {analysis.created_at}
                    </p>
                  </div>
                  <Link
                    href={`/app/analyses/${analysis.analysis_id}/overview`}
                    className={buttonVariants({
                      size: "sm",
                      variant: "secondary",
                    })}
                  >
                    Open Workbench
                  </Link>
                </div>
              ))}
            </div>
          )}

          {attachableAnalyses.length > 0 ? (
            <form
              action={attachAnalysisAction}
              className="mt-5 rounded-md border border-border-subtle bg-surface-white p-4"
            >
              <label className="block text-sm font-medium text-text-institutional">
                Attach an existing analysis
                <select
                  name="analysis_id"
                  className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                >
                  {attachableAnalyses.map((analysis) => (
                    <option
                      key={analysis.analysis_id}
                      value={analysis.analysis_id}
                    >
                      {analysis.strategy_name} · {analysis.status} ·{" "}
                      {analysis.created_at}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" className="mt-3">
                Attach Analysis
              </Button>
            </form>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/app/new-analysis"
                className={buttonVariants({ size: "sm" })}
              >
                Import New Evidence
              </Link>
              <Link
                href="/app/analyses"
                className={buttonVariants({ size: "sm", variant: "secondary" })}
              >
                Open Audit Library
              </Link>
            </div>
          )}
        </WorkspaceCard>

        <WorkspaceCard
          title="Program timeline"
          subtitle="A tenant-scoped event trail for thesis, imports, verdicts, reports, and handoffs."
        >
          {detail.events.length === 0 ? (
            <p className="text-sm text-text-neutral">No timeline events yet.</p>
          ) : (
            <div className="space-y-3">
              {detail.events.map((event) => (
                <div
                  key={event.event_id}
                  className="rounded-md border border-border-subtle bg-surface-subtle p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-text-institutional">
                      {event.title}
                    </p>
                    <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">
                      {event.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-neutral">
                    {event.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </WorkspaceCard>
      </div>

      {detail.research_briefs.length > 0 ? (
        <WorkspaceCard
          title="Accepted research briefs"
          subtitle="Versioned briefs become the source for hypothesis-spec generation."
        >
          <div className="space-y-3">
            {detail.research_briefs.map((brief) => (
              <div
                key={brief.brief_id}
                className="rounded-md border border-border-subtle bg-surface-subtle p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-text-institutional">
                    Brief v{brief.version}
                  </p>
                  <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">
                    {brief.brief.readiness.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">
                  {brief.brief.market_intuition}
                </p>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      ) : null}
    </AnalysisPageFrame>
  );
}
