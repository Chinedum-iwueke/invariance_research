import { cn } from "@/lib/utils";
import type { AnalysisStatus } from "@/lib/contracts";

const statusStyles: Record<AnalysisStatus, string> = {
  completed: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive",
  processing: "border-chart-benchmark/30 bg-chart-benchmark/10 text-chart-benchmark",
  queued: "border-brand/30 bg-brand/10 text-brand",
  uploaded: "border-text-neutral/30 bg-surface-panel text-text-neutral",
  draft: "border-text-neutral/30 bg-surface-panel text-text-neutral",
  failed: "border-chart-negative/30 bg-chart-negative/10 text-chart-negative",
};

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  return <span className={cn("rounded-sm border px-2 py-1 text-xs font-medium capitalize", statusStyles[status])}>{status}</span>;
}
