import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Program Hypotheses",
  description: "Approved and draft hypotheses for a research program.",
};

export default async function ProgramHypothesesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  return (
    <AnalysisPageFrame title={`${detail.program.title} / Hypotheses`} description="Versioned thesis contracts, invalidation criteria, required evidence, and approval state.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
      </div>
      <WorkspaceCard title="Hypothesis versions" subtitle="Every executable strategy must trace back to an approved hypothesis version.">
        {detail.hypothesis_versions.length === 0 ? (
          <p className="text-sm text-text-neutral">No hypothesis versions yet. Accept a research brief, then draft the first hypothesis spec from the program workbench.</p>
        ) : (
          <div className="space-y-4">
            {detail.hypothesis_versions.map((version) => (
              <article key={version.hypothesis_version_id} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-text-institutional">{version.spec.title}</h2>
                  <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{version.status.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">{version.spec.thesis}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Invalidation criteria</p>
                    <div className="mt-2 space-y-2">
                      {version.spec.invalidation_criteria.map((item) => (
                        <p key={item} className="rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-neutral">{item}</p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Required datasets</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {version.spec.required_datasets.map((item) => (
                        <span key={item} className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{item}</span>
                      ))}
                    </div>
                    {version.validation_errors.length ? (
                      <div className="mt-3 space-y-2">
                        {version.validation_errors.map((error) => (
                          <p key={error} className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
