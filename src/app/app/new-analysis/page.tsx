import type { Metadata } from "next";
import { AnalysisPageFrame } from "@/components/dashboard/analysis-page-frame";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { UploadDropzoneShell } from "@/components/forms/upload-dropzone-shell";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "New Analysis",
  description: "Upload shell for new strategy validation artifacts.",
};

export default function NewAnalysisPage() {
  return (
    <AnalysisPageFrame
      title="New Analysis"
      description="Prepare artifacts for validation intake. Upload processing, parsing, and run orchestration will be enabled in Phase 4."
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <UploadDropzoneShell />
        <div className="space-y-4">
          <WorkspaceCard title="Accepted artifacts" subtitle="Current intake format">
            <ul className="space-y-2 text-sm text-text-neutral">
              <li>• Backtest summary (CSV/JSON)</li>
              <li>• Trade history with timestamps</li>
              <li>• Fee/slippage assumptions</li>
              <li>• Optional strategy notes PDF</li>
            </ul>
          </WorkspaceCard>
          <WorkspaceCard title="Pre-validation hints" subtitle="Improve intake quality">
            <p className="text-sm text-text-neutral">Ensure timezone normalization, execution assumptions, and asset metadata are explicitly documented.</p>
            <p className="mt-2 text-xs text-text-neutral">Sample artifact package available in Phase 4 onboarding.</p>
            <button className={buttonVariants({ className: "mt-4 w-full", variant: "secondary" })} disabled>
              Submit for Validation (coming soon)
            </button>
          </WorkspaceCard>
          <WorkspaceCard title="Confidentiality" subtitle="Audit-grade handling">
            <p className="text-sm text-text-neutral">Artifacts are treated under strict confidentiality standards and can be scoped for NDA workflows during analyst engagement.</p>
          </WorkspaceCard>
        </div>
      </div>
    </AnalysisPageFrame>
  );
}
