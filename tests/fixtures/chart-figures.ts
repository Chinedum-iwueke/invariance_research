import type { FigurePayload } from "../../src/lib/contracts";

export const chartFixtures: Record<string, FigurePayload> = {
  overview_line: {
    figure_id: "overview-equity-line",
    title: "Equity curve",
    subtitle: "Overview surface",
    type: "line",
    x_label: "Trade #",
    y_label: "Equity",
    series: [
      { key: "equity", label: "Equity", series_type: "line", points: [{ x: 1, y: 100 }, { x: 2, y: 104 }, { x: 3, y: 109 }] },
    ],
    note: "Engine emitted equity path.",
    provenance: "engine_native",
  },
  distribution_histogram: {
    figure_id: "distribution-hist",
    title: "PnL histogram",
    type: "histogram",
    x_label: "Bucket",
    y_label: "Frequency",
    series: [],
    bins: [
      { low: -2, high: -1, count: 5 },
      { low: -1, high: 0, count: 12 },
      { low: 0, high: 1, count: 9 },
    ],
  },
  distribution_grouped_bar: {
    figure_id: "distribution-grouped",
    title: "Distribution by regime",
    type: "grouped_bar",
    x_label: "Regime",
    y_label: "Return",
    series: [
      { key: "strategy", label: "Strategy", series_type: "bar", points: [{ x: "Bull", y: 12 }, { x: "Bear", y: -4 }] },
      { key: "benchmark", label: "Benchmark", series_type: "bar", points: [{ x: "Bull", y: 8 }, { x: "Bear", y: -6 }] },
    ],
  },
  monte_carlo_fan: {
    figure_id: "mc-fan",
    title: "MC fan",
    type: "fan_chart",
    x_label: "Simulation step",
    y_label: "Equity",
    series: [
      { key: "p5", label: "P5", series_type: "line", points: [{ x: 1, y: 85 }, { x: 2, y: 80 }] },
      { key: "p25", label: "P25", series_type: "line", points: [{ x: 1, y: 95 }, { x: 2, y: 94 }] },
      { key: "p50", label: "P50", series_type: "line", points: [{ x: 1, y: 100 }, { x: 2, y: 102 }] },
      { key: "p75", label: "P75", series_type: "line", points: [{ x: 1, y: 107 }, { x: 2, y: 110 }] },
      { key: "p95", label: "P95", series_type: "line", points: [{ x: 1, y: 120 }, { x: 2, y: 126 }] },
    ],
  },
  monte_carlo_histogram: {
    figure_id: "mc-hist",
    title: "MC terminal distribution",
    type: "histogram",
    x_label: "Terminal return bucket",
    y_label: "Path count",
    series: [
      { key: "hist", label: "Histogram", series_type: "bar", points: [{ x: "-20% to -10%", y: 40 }, { x: "-10% to 0%", y: 60 }, { x: "0% to 10%", y: 80 }] },
    ],
  },
  execution_line: {
    figure_id: "execution-sensitivity",
    title: "Execution expectancy",
    type: "line",
    x_label: "Scenario",
    y_label: "Expectancy",
    series: [
      { key: "baseline", label: "Baseline", series_type: "line", points: [{ x: "Baseline", y: 0.9 }, { x: "Stressed", y: 0.45 }] },
    ],
  },
  ruin_bar: {
    figure_id: "ruin-surface",
    title: "Risk of ruin",
    type: "bar",
    x_label: "Risk per trade",
    y_label: "Ruin probability",
    series: [
      { key: "ruin", label: "Ruin", series_type: "bar", points: [{ x: "0.5%", y: 3 }, { x: "1.0%", y: 8 }, { x: "2.0%", y: 18 }] },
    ],
  },
  report_scatter: {
    figure_id: "report-scatter",
    title: "Trade return vs duration",
    type: "scatter",
    x_label: "Duration",
    y_label: "Return",
    series: [
      { key: "trades", label: "Trades", series_type: "scatter", points: [{ x: 2, y: 0.4 }, { x: 6, y: 1.1 }, { x: 1, y: -0.2 }] },
    ],
  },
  report_heatmap: {
    figure_id: "report-heatmap",
    title: "Regime sensitivity",
    type: "heatmap",
    x_label: "Month",
    y_label: "Regime",
    series: [
      { key: "bull", label: "Bull", series_type: "line", points: [{ x: "Jan", y: 1.3 }, { x: "Feb", y: 1.1 }] },
      { key: "bear", label: "Bear", series_type: "line", points: [{ x: "Jan", y: -0.4 }, { x: "Feb", y: -0.8 }] },
    ],
  },
  report_benchmark_relative: {
    figure_id: "overview-benchmark-relative",
    title: "Strategy vs Benchmark",
    subtitle: "Excess return view",
    type: "line",
    x_label: "Date",
    y_label: "Excess return",
    series: [
      { key: "strategy", label: "Strategy", series_type: "line", points: [{ x: "2025-01", y: 0.02 }, { x: "2025-02", y: 0.03 }] },
      { key: "benchmark", label: "Benchmark", series_type: "line", points: [{ x: "2025-01", y: 0.01 }, { x: "2025-02", y: 0.025 }] },
    ],
  },
};
