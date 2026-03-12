import type { KeyMetric } from "@/lib/mock/analysis";
import { MetricCard } from "@/components/ui/metric-card";

export function MetricTile({ metric }: { metric: KeyMetric }) {
  return <MetricCard label={metric.label} value={metric.value} helper={metric.helper ?? ""} tone={metric.tone ?? "neutral"} />;
}
