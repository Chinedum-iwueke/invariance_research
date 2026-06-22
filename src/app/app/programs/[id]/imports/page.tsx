import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisStatusBadge } from "@/components/dashboard/analysis-status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Program Imports",
  description: "Imported audit evidence attached to a research program.",
};

export default async function ProgramImportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  return (
    <AnalysisPageFrame title={`${detail.program.title} Imports`} description="Imported trade evidence remains attached to the program, its claims, and its decisions.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
        <Link href="/app/new-analysis" className={buttonVariants({ size: "sm" })}>Import New Evidence</Link>
      </div>

      <WorkspaceCard title="Audit evidence" subtitle="Imported analyses, broker exports, trade histories, and validation reports attached to this thesis.">
        {detail.analyses.length === 0 ? (
          <EmptyState
            title="No audit imports attached"
            body="Attach existing evidence from the program page, or import a new artifact and use it as supporting evidence for the thesis."
            cta={{ label: "Import Evidence", href: "/app/new-analysis" }}
          />
        ) : (
          <div className="space-y-3">
            {detail.analyses.map((analysis) => (
              <div key={analysis.analysis_id} className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-medium text-text-institutional">{analysis.strategy_name}</h2>
                    <AnalysisStatusBadge status={analysis.status} />
                  </div>
                  <p className="mt-1 text-xs text-text-neutral">{analysis.asset} · {analysis.timeframe} · {analysis.trade_count} trades · created {analysis.created_at}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Link href={`/app/analyses/${analysis.analysis_id}/overview`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Open Workbench</Link>
                  <Link href={`/app/analyses/${analysis.analysis_id}/report`} className={buttonVariants({ size: "sm", variant: "tertiary" })}>Report</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
