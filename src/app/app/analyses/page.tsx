import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { AnalysisArchiveSearch } from "@/components/dashboard/analysis-archive-search";
import { AnalysesLibrary } from "@/components/dashboard/analyses-library";

export const metadata: Metadata = {
  title: "Analyses",
  description: "Analysis history and artifact archive.",
};

export default function AnalysesPage() {
  return (
    <AnalysisPageFrame
      title="Analyses Library"
    >
      <WorkspaceCard title="Archive controls">
        <AnalysisArchiveSearch />
      </WorkspaceCard>
      <AnalysesLibrary />
    </AnalysisPageFrame>
  );
}
