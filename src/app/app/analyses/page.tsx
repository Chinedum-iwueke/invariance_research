import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SkeletonState } from "@/components/dashboard/skeleton-state";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { analysisLibrary } from "@/lib/mock/analysis";

export const metadata: Metadata = {
  title: "Analyses",
  description: "Analysis history and artifact archive.",
};

export default function AnalysesPage() {
  return (
    <AnalysisPageFrame
      title="Analyses Library"
      description="Search and review strategy validation artifacts, statuses, and robustness summaries."
    >
      <WorkspaceCard title="Search and filters" subtitle="Shell controls for Phase 4">
        <div className="grid gap-2 md:grid-cols-4">
          <input className="h-10 rounded-sm border px-3 text-sm" placeholder="Search strategy name" />
          <select className="h-10 rounded-sm border px-3 text-sm"><option>All statuses</option></select>
          <select className="h-10 rounded-sm border px-3 text-sm"><option>All assets</option></select>
          <select className="h-10 rounded-sm border px-3 text-sm"><option>Newest first</option></select>
        </div>
      </WorkspaceCard>

      <AnalysisTable analyses={analysisLibrary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <EmptyState title="No archived analyses for this filter" body="Adjust filters or start a new analysis to populate this view." cta={{ label: "Create New Analysis", href: "/app/new-analysis" }} />
        <SkeletonState rows={4} />
      </div>
    </AnalysisPageFrame>
  );
}
