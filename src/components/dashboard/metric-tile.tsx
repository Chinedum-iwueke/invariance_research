import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KeyMetric } from "@/lib/app/analysis-ui";

const toneClasses = {
  neutral: "text-text-institutional",
  positive: "text-chart-positive",
  negative: "text-chart-negative",
  warning: "text-brand",
} as const;

export function MetricTile({ metric }: { metric: KeyMetric }) {
  const tone = metric.tone ?? "neutral";

  return (
    <Card className="space-y-2 rounded-md border bg-surface-white p-card-md shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-neutral">{metric.label}</p>
      <p className={cn("text-[2rem] font-medium leading-none tracking-tight", toneClasses[tone])}>{metric.value}</p>
      {metric.helper ? <p className="text-xs leading-relaxed text-text-neutral">{metric.helper}</p> : <div className="h-4" />}
    </Card>
  );
}
