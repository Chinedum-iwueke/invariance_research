import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { AnalysesLibrary } from "@/components/dashboard/analyses-library";

export const metadata: Metadata = {
  title: "Analyses",
  description: "Analysis history and artifact archive.",
};

export default function AnalysesPage() {
  return (
    <AnalysisPageFrame
      title="Analyses Library"
      description="Archive of uploaded research artifacts and analysis lifecycle statuses."
    >
      <WorkspaceCard title="Archive controls" subtitle="Filtering will expand in Phase 5">
        <p className="text-sm text-text-neutral">Status and metadata are sourced from backend analysis/job records.</p>
      </WorkspaceCard>
      <AnalysesLibrary />
    </AnalysisPageFrame>
  );
}
