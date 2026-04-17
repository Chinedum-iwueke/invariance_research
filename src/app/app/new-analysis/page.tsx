import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { NewAnalysisIntake } from "@/components/forms/new-analysis-intake";

export const metadata: Metadata = {
  title: "New Analysis",
  description: "Upload intake and analysis orchestration workflow.",
};

export default function NewAnalysisPage() {
  return (
    <AnalysisPageFrame title="New Analysis">
      <NewAnalysisIntake />
    </AnalysisPageFrame>
  );
}
