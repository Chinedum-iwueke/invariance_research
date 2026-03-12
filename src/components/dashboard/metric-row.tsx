import type { KeyMetric } from "@/lib/mock/analysis";
import { MetricTile } from "@/components/dashboard/metric-tile";

export function MetricRow({ metrics, cols = 4 }: { metrics: KeyMetric[]; cols?: 3 | 4 | 6 }) {
  const grid = cols === 6 ? "md:grid-cols-3 2xl:grid-cols-6" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4";
  return (
    <div className={`grid gap-4 ${grid}`}>
      {metrics.map((metric) => (
        <MetricTile key={metric.label} metric={metric} />
      ))}
    </div>
  );
}
