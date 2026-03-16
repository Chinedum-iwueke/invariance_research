import { cn } from "@/lib/utils";

const statusTone: Record<string, string> = {
  completed: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive",
  processed: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive",
  active: "border-chart-positive/30 bg-chart-positive/10 text-chart-positive",
  failed: "border-chart-negative/30 bg-chart-negative/10 text-chart-negative",
  canceled: "border-chart-negative/30 bg-chart-negative/10 text-chart-negative",
  processing: "border-brand/30 bg-brand/10 text-brand",
  queued: "border-brand/30 bg-brand/10 text-brand",
  received: "border-chart-benchmark/30 bg-chart-benchmark/10 text-chart-benchmark",
};

function Badge({ value }: { value: string }) {
  return <span className={cn("rounded-sm border px-2 py-1 text-xs font-medium capitalize", statusTone[value] ?? "border-border-subtle bg-surface-panel text-text-neutral")}>{value.replaceAll("_", " ")}</span>;
}

export const JobStatusBadge = Badge;
export const WebhookStatusBadge = Badge;
export const ExportStatusBadge = Badge;
export const AccountPlanBadge = Badge;
