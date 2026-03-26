import { DiagnosticFigure } from "@/components/dashboard/diagnostic-figure";
import { FigureCard } from "@/components/dashboard/figure-card";
import type { OverviewBenchmarkComparison } from "@/lib/diagnostics/overview/map-benchmark-payload";

export function StrategyVsBenchmarkChart({ benchmark }: { benchmark: OverviewBenchmarkComparison }) {
  if (!benchmark.available || !benchmark.figure) return null;

  return (
    <FigureCard
      title={benchmark.figure.title || "Strategy vs Benchmark"}
      subtitle={benchmark.figure.subtitle || "Daily normalized comparison"}
      figure={<DiagnosticFigure figure={benchmark.figure} emptyMessage="No benchmark comparison figure was emitted for this run." />}
      note="Series are plotted exactly as emitted by the engine on the aligned daily comparison basis."
    />
  );
}
