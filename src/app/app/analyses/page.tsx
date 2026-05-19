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
      <section className="artifact-surface grid gap-4 rounded-md border border-border-subtle bg-surface-white p-5 shadow-sm lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Analysis library / case files</p>
          <h2 className="font-display mt-2 text-[clamp(1.7rem,3vw,2.8rem)] font-medium leading-none text-text-institutional">Every run is stored as evidence, not just history.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-text-neutral">
            Open a workbench to inspect the verdict, missing evidence, diagnostic support, assumptions, export state, and Research Desk handoff path for that strategy.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ["1", "Find the case file"],
            ["2", "Inspect falsification pages"],
            ["3", "Generate or rescue the report"],
          ].map(([step, label]) => (
            <div key={step} className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Step {step}</p>
              <p className="mt-1 text-sm font-medium text-text-institutional">{label}</p>
            </div>
          ))}
        </div>
      </section>
      <WorkspaceCard title="Archive controls" subtitle="Find an analysis by strategy name, ID, asset, or run context.">
        <AnalysisArchiveSearch />
      </WorkspaceCard>
      <AnalysesLibrary />
    </AnalysisPageFrame>
  );
}
