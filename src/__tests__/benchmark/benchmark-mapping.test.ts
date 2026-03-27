import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkReasonLabel, mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";

test("mapOverviewBenchmarkPayload maps full available payload", () => {
  const mapped = mapOverviewBenchmarkPayload({
    benchmark_comparison: {
      available: true,
      limited: false,
      summary_metrics: {
        benchmark_selected: "SPY",
        strategy_return: "0.15",
        benchmark_return: 0.09,
        excess_return_vs_benchmark: 0.06,
      },
      metadata: {
        benchmark_id: "SPY",
        benchmark_source: "platform_managed",
        library_revision: "2026-03-01",
        benchmark_frequency: "1d",
        comparison_frequency: "1d",
        alignment_basis: "window_intersection",
        normalization_basis: "100_at_first_common_timestamp",
        comparison_window_start: "2025-01-01",
        comparison_window_end: "2025-12-31",
        point_count: "252",
      },
      assumptions: ["A1"],
      limitations: ["L1"],
      figure: {
        type: "timeseries_overlay",
        title: "Strategy vs Benchmark",
        series: [
          { id: "strategy", label: "Strategy", points: [["2025-01-01", 100], ["2025-01-02", 101]] },
          { id: "benchmark", label: "Benchmark", points: [{ x: "2025-01-01", y: 100 }, { x: "2025-01-02", y: "100.5" }] },
        ],
      },
    },
  });

  assert.ok(mapped);
  assert.equal(mapped?.available, true);
  assert.equal(mapped?.summary_metrics?.strategy_return, 0.15);
  assert.equal(mapped?.metadata?.point_count, 252);
  assert.equal(mapped?.figure?.series.length, 2);
  assert.equal(mapped?.reason_label, undefined);
});

test("mapOverviewBenchmarkPayload maps unavailable payload with mapped reason label", () => {
  const mapped = mapOverviewBenchmarkPayload({
    benchmark_comparison: {
      available: false,
      reason: "benchmark_dataset_load_failed",
      assumptions: [],
      limitations: ["Dataset was not readable"],
    },
  });

  assert.ok(mapped);
  assert.equal(mapped?.available, false);
  assert.equal(mapped?.reason_label, "Benchmark dataset unavailable");
  assert.deepEqual(mapped?.limitations, ["Dataset was not readable"]);
  assert.equal(mapped?.figure, undefined);
});

test("mapOverviewBenchmarkPayload gracefully handles missing fields and malformed points", () => {
  const mapped = mapOverviewBenchmarkPayload({
    benchmark_comparison: {
      available: true,
      figure: {
        title: "Bad figure",
        series: [
          { id: "broken", points: [["2025-01-01", "not-a-number"]] },
          { id: "ok", points: [["2025-01-01", 100]] },
        ],
      },
      assumptions: ["ok", 123, null],
      limitations: "not-an-array",
    },
  });

  assert.ok(mapped);
  assert.deepEqual(mapped?.assumptions, ["ok"]);
  assert.deepEqual(mapped?.limitations, []);
  assert.equal(mapped?.figure?.series.length, 1);
  assert.equal(mapped?.figure?.series[0]?.key, "ok");
});

test("benchmarkReasonLabel maps known reasons and falls back for unknown reasons", () => {
  assert.equal(benchmarkReasonLabel("insufficient_aligned_points"), "Insufficient comparison data");
  assert.equal(benchmarkReasonLabel("new_reason_type"), "New Reason Type");
  assert.equal(benchmarkReasonLabel(undefined), undefined);
});
