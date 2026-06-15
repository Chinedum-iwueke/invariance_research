import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Program Experiments",
  description: "Experiment plans and queued items for a research program.",
};

export default async function ProgramExperimentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  return (
    <AnalysisPageFrame title={`${detail.program.title} / Experiments`} description="Approved experiment plans, falsification questions, queue status, and worker progress.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
        <Link href={`/app/programs/${id}/runs`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Runs</Link>
      </div>
      <WorkspaceCard title="Experiment plans" subtitle="Each plan item is a pre-registered falsification question before execution.">
        {detail.experiment_plans.length === 0 ? (
          <p className="text-sm text-text-neutral">No experiment plan yet. Approve a strategy spec, then generate an experiment plan from the program workbench.</p>
        ) : (
          <div className="space-y-4">
            {detail.experiment_plans.map((plan) => (
              <article key={plan.experiment_plan_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-text-institutional">{plan.plan.plan_title}</h2>
                  <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{plan.status}</span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {plan.plan.items.map((item) => (
                    <div key={item.item_id} className="rounded-md border border-border-subtle bg-surface-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-text-institutional">{item.title}</p>
                        <span className="rounded-sm border border-border-subtle bg-surface-subtle px-2 py-1 text-[11px] text-text-neutral">{item.experiment_type.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-neutral">{item.falsification_question}</p>
                      <p className="mt-2 text-xs text-text-neutral">priority {item.priority} · {item.runtime_budget.max_variants} variant(s) · {item.runtime_budget.max_minutes} min</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
