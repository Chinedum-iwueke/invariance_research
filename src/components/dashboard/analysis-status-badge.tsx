import { cn } from "@/lib/utils";
import type { AnalysisStatus } from "@/lib/mock/analysis";

const statusStyles: Record<AnalysisStatus, string> = {
  completed: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive",
  running: "border-chart-benchmark/30 bg-chart-benchmark/10 text-chart-benchmark",
  queued: "border-brand/30 bg-brand/10 text-brand",
  failed: "border-chart-negative/30 bg-chart-negative/10 text-chart-negative",
};

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  return <span className={cn("rounded-sm border px-2 py-1 text-xs font-medium capitalize", statusStyles[status])}>{status}</span>;
}
