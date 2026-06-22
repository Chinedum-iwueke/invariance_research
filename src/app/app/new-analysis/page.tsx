import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { NewAnalysisIntake } from "@/components/forms/new-analysis-intake";

export const metadata: Metadata = {
  title: "Import & Audit",
  description: "Import existing crypto strategy evidence into Research Desk.",
};

export default function NewAnalysisPage() {
  return (
    <AnalysisPageFrame title="Import & Audit" description="Upload existing crypto strategy evidence, inspect what it can and cannot prove, then attach the result to a Research Program.">
      <NewAnalysisIntake />
    </AnalysisPageFrame>
  );
}
