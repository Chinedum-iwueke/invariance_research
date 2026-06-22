import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { ResearchMemoryPanel } from "@/components/research-programs/research-memory-panel";
import { buttonVariants } from "@/components/ui/button";
import { requireServerSession } from "@/lib/server/auth/session";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Program Memory",
  description: "Tenant-scoped research memory for a program.",
};

export default async function ProgramMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireServerSession();
  const detail = await getResearchProgramDetail(id, session.account_id);
  if (!detail) notFound();

  return (
    <AnalysisPageFrame title={`${detail.program.title} Memory`} description="Remembered verdicts, findings, next experiments, and similar run signatures for this program only.">
      <div className="flex flex-wrap gap-2">
        <Link href={`/app/programs/${id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Back to Program</Link>
        <Link href="/app/memory" className={buttonVariants({ size: "sm", variant: "tertiary" })}>Account Memory</Link>
      </div>
      <WorkspaceCard title="Program memory" subtitle="Verdicts, findings, and next tests scoped to this thesis and account.">
        <ResearchMemoryPanel memory={detail.memory} />
      </WorkspaceCard>
    </AnalysisPageFrame>
  );
}
