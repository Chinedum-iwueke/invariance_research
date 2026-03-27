import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { OverviewBenchmarkSection } from "@/components/diagnostics/overview/OverviewBenchmarkSection";
import type { OverviewBenchmarkComparison } from "@/lib/diagnostics/overview/map-benchmark-payload";

function isElement(node: ReactNode): node is ReactElement {
  return Boolean(node) && typeof node === "object" && "props" in (node as object);
}

function flatten(node: ReactNode): ReactElement[] {
  if (!isElement(node)) return [];
  const children = node.props?.children;
  const nested = Array.isArray(children)
    ? children.flatMap((child) => flatten(child))
    : children
      ? flatten(children)
      : [];
  return [node, ...nested];
}

function renderTree(benchmark?: OverviewBenchmarkComparison): ReactElement | null {
  return OverviewBenchmarkSection({ benchmark }) as ReactElement | null;
}

const availableBenchmark: OverviewBenchmarkComparison = {
  available: true,
  limited: false,
  assumptions: ["Normalized at first overlapping timestamp"],
  limitations: ["Holiday gaps may reduce overlap"],
  summary_metrics: {
    benchmark_selected: "SPY",
    strategy_return: 0.12,
    benchmark_return: 0.08,
    excess_return_vs_benchmark: 0.04,
  },
  metadata: {
    benchmark_id: "SPY",
    benchmark_source: "platform_managed",
  },
  figure: {
    figure_id: "overview-benchmark-comparison",
    title: "Strategy vs Benchmark",
    subtitle: "Daily normalized comparison",
    type: "line",
    series: [{ key: "strategy", label: "Strategy", series_type: "line", points: [{ x: "2025-01-01", y: 100 }] }],
  },
};

test("OverviewBenchmarkSection available state renders cards, chart, metadata, and assumptions wiring", () => {
  const tree = renderTree(availableBenchmark);
  assert.ok(tree);
  assert.equal(tree.type, "section");

  const nodes = flatten(tree);
  const benchmarkCards = nodes.find((node) => (node.type as { name?: string })?.name === "OverviewBenchmarkCards");
  const chart = nodes.find((node) => (node.type as { name?: string })?.name === "StrategyVsBenchmarkChart");
  const metadata = nodes.find((node) => (node.type as { name?: string })?.name === "BenchmarkMetadataPanel");

  assert.ok(benchmarkCards);
  assert.ok(chart);
  assert.ok(metadata);
  assert.equal((metadata?.props as { benchmark: OverviewBenchmarkComparison }).benchmark.assumptions[0], "Normalized at first overlapping timestamp");
});

test("OverviewBenchmarkSection unavailable state renders reason text and hides chart/metrics", () => {
  const benchmark: OverviewBenchmarkComparison = {
    available: false,
    limited: true,
    reason: "no_benchmark_overlap",
    reason_label: "No overlapping benchmark data",
    assumptions: [],
    limitations: ["Strategy and benchmark windows do not intersect"],
  };
  const tree = renderTree(benchmark);

  assert.ok(tree);
  assert.equal((tree.type as { name?: string }).name, "UnavailablePanel");
  assert.equal((tree.props as { benchmark: OverviewBenchmarkComparison }).benchmark.reason_label, "No overlapping benchmark data");
  const nodes = flatten(tree);
  assert.equal(nodes.some((node) => (node.type as { name?: string })?.name === "StrategyVsBenchmarkChart"), false);
  assert.equal(nodes.some((node) => (node.type as { name?: string })?.name === "OverviewBenchmarkCards"), false);
});

test("OverviewBenchmarkSection handles missing figure and summary_metrics without crashing", () => {
  const tree = renderTree({
    ...availableBenchmark,
    summary_metrics: undefined,
    figure: undefined,
  });

  assert.ok(tree);
  const nodes = flatten(tree);
  const chart = nodes.find((node) => (node.type as { name?: string })?.name === "StrategyVsBenchmarkChart");
  const cards = nodes.find((node) => (node.type as { name?: string })?.name === "OverviewBenchmarkCards");
  assert.ok(chart);
  assert.ok(cards);
  assert.equal((chart?.props as { benchmark: OverviewBenchmarkComparison }).benchmark.figure, undefined);
  assert.equal((cards?.props as { benchmark: OverviewBenchmarkComparison }).benchmark.summary_metrics, undefined);
});

test("OverviewBenchmarkSection returns null when benchmark payload is missing", () => {
  assert.equal(renderTree(undefined), null);
});
