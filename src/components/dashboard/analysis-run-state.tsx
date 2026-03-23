import Link from "next/link";
import type { AnalysisEntity } from "@/lib/server/analysis/models";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";

export function AnalysisRunState({ analysis }: { analysis: AnalysisEntity }) {
  const isCompletedWithoutResult = analysis.status === "completed" && !analysis.result;
  const title = isCompletedWithoutResult ? "Run completed without persisted result payload" : `Analysis is ${analysis.status}`;
  const body = isCompletedWithoutResult
    ? "The worker marked this analysis completed, but no AnalysisRecord is available to render diagnostics."
    : "Diagnostics are only shown after a persisted AnalysisRecord exists.";

  return (
    <WorkspaceCard title={title} subtitle="Real run status">
      <div className="space-y-3 text-sm text-text-neutral">
        <p>{body}</p>
        {analysis.failure_message ? <p className="text-red-600">Failure: {analysis.failure_message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Link href={`/api/analyses/${analysis.analysis_id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>Inspect API payload</Link>
          <Link href="/app/analyses" className={buttonVariants({ size: "sm" })}>Back to analyses</Link>
        </div>
      </div>
    </WorkspaceCard>
  );
}
