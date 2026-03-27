import assert from "node:assert/strict";
import test from "node:test";
import { adaptFigureToECharts, supportedFigureTypes } from "../src/lib/charts/adapters/index.ts";
import { chartFixtures } from "./fixtures/chart-figures.ts";

function assertAdapted(key: keyof typeof chartFixtures) {
  const result = adaptFigureToECharts(chartFixtures[key]);
  assert.equal(result.rendererSupported, true, `${String(key)} should be adapter-supported`);
  assert.ok(result.adapted, `${String(key)} should produce adapted chart options`);
  return result.adapted;
}

test("adapter seam includes next tranche figure types", () => {
  assert.ok(supportedFigureTypes.includes("scatter"));
  assert.ok(supportedFigureTypes.includes("heatmap"));
});

test("overview line fixture adapts with visible axis names", () => {
  const adapted = assertAdapted("overview_line");
  const option = adapted.option as { xAxis?: { name?: string }; yAxis?: { name?: string } };
  assert.equal(option.xAxis?.name, "Trade #");
  assert.equal(option.yAxis?.name, "Equity");
});

test("distribution fixtures adapt for histogram and grouped bar", () => {
  const histogram = assertAdapted("distribution_histogram");
  const grouped = assertAdapted("distribution_grouped_bar");
  const histogramOption = histogram.option as { series?: Array<{ type?: string }> };
  const groupedOption = grouped.option as { legend?: { show?: boolean } };

  assert.equal(histogramOption.series?.[0]?.type, "bar");
  assert.equal(groupedOption.legend?.show, true);
});

test("monte-carlo fixtures adapt for fan chart and histogram", () => {
  const fan = assertAdapted("monte_carlo_fan");
  const histogram = assertAdapted("monte_carlo_histogram");

  const fanOption = fan.option as { series?: Array<{ type?: string }>; legend?: { show?: boolean } };
  const histOption = histogram.option as { series?: Array<{ type?: string }> };

  assert.equal(Boolean(fanOption.series?.length && fanOption.series.length >= 2), true);
  assert.equal(fanOption.legend?.show, true);
  assert.equal(histOption.series?.[0]?.type, "bar");
});

test("execution and ruin fixtures adapt to line/bar options", () => {
  const execution = assertAdapted("execution_line");
  const ruin = assertAdapted("ruin_bar");
  const executionOption = execution.option as { series?: Array<{ type?: string }> };
  const ruinOption = ruin.option as { series?: Array<{ type?: string }> };
  assert.equal(executionOption.series?.[0]?.type, "line");
  assert.equal(ruinOption.series?.[0]?.type, "bar");
});

test("report fixtures adapt for scatter, heatmap, and benchmark-relative overlays", () => {
  const scatter = assertAdapted("report_scatter");
  const heatmap = assertAdapted("report_heatmap");
  const benchmark = assertAdapted("report_benchmark_relative");

  const scatterOption = scatter.option as { series?: Array<{ type?: string }> };
  const heatmapOption = heatmap.option as { series?: Array<{ type?: string }>; visualMap?: unknown };
  const benchmarkOption = benchmark.option as { series?: Array<{ markLine?: unknown }> };

  assert.equal(scatterOption.series?.[0]?.type, "scatter");
  assert.equal(heatmapOption.series?.[0]?.type, "heatmap");
  assert.ok(heatmapOption.visualMap);
  assert.ok(benchmarkOption.series?.every((series) => Boolean(series.markLine)));
});
