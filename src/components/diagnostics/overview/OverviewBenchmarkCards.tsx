import { Card } from "@/components/ui/card";
import type { OverviewBenchmarkComparison } from "@/lib/diagnostics/overview/map-benchmark-payload";

function formatPercent(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
}

function metricTone(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "text-text-institutional";
  if (value > 0) return "text-chart-positive";
  if (value < 0) return "text-chart-negative";
  return "text-text-institutional";
}

function MetricCard({ label, value, toneClass = "text-text-institutional" }: { label: string; value: string; toneClass?: string }) {
  return (
    <Card className="space-y-2 rounded-md border bg-surface-white p-card-md shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-neutral">{label}</p>
      <p className={`text-[1.75rem] font-medium leading-none tracking-tight ${toneClass}`}>{value}</p>
    </Card>
  );
}

export function OverviewBenchmarkCards({ benchmark }: { benchmark: OverviewBenchmarkComparison }) {
  if (!benchmark.available || !benchmark.summary_metrics) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Strategy Return"
        value={formatPercent(benchmark.summary_metrics.strategy_return)}
        toneClass={metricTone(benchmark.summary_metrics.strategy_return)}
      />
      <MetricCard
        label="Benchmark Return"
        value={formatPercent(benchmark.summary_metrics.benchmark_return)}
        toneClass={metricTone(benchmark.summary_metrics.benchmark_return)}
      />
      <MetricCard
        label="Excess Return vs Benchmark"
        value={formatPercent(benchmark.summary_metrics.excess_return_vs_benchmark)}
        toneClass={metricTone(benchmark.summary_metrics.excess_return_vs_benchmark)}
      />
      <MetricCard
        label="Benchmark Selected"
        value={benchmark.summary_metrics.benchmark_selected ?? benchmark.metadata?.benchmark_id ?? "N/A"}
      />
    </div>
  );
}
