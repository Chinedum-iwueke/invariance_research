import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { NewAnalysisIntake } from "@/components/forms/new-analysis-intake";

export const metadata: Metadata = {
  title: "Audit Import",
  description: "Import existing strategy evidence into the research pipeline.",
};

export default function NewAnalysisPage() {
  return (
    <AnalysisPageFrame title="Audit Import" description="Upload existing strategy evidence, inspect what it can and cannot prove, then attach the resulting analysis to a Research Program when useful.">
      <NewAnalysisIntake />
    </AnalysisPageFrame>
  );
}
