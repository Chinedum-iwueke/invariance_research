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
      description="A persistent archive of strategy evidence packets, diagnostic status, and report-ready validation work."
    >
      <WorkspaceCard title="Archive controls" subtitle="Find an analysis by strategy name, ID, asset, or run context.">
        <AnalysisArchiveSearch />
      </WorkspaceCard>
      <AnalysesLibrary />
    </AnalysisPageFrame>
  );
}
