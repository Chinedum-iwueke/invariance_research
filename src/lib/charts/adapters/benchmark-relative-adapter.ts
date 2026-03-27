import type { FigurePayload } from "@/lib/contracts";
import type { AdaptedChart, FigureTypeAdapter } from "./types";
import { barAdapter } from "./bar-adapter";
import { lineAdapter } from "./line-adapter";

function textHasBenchmark(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  return /benchmark|excess|relative/i.test(value) || /vs\.?\s+benchmark/i.test(value);
}

export function isBenchmarkRelativeFigure(figure: FigurePayload, seriesLabels: string[]): boolean {
  const titleSignal = textHasBenchmark(figure.title) || textHasBenchmark(figure.subtitle) || textHasBenchmark(figure.note);
  const labelSignal = seriesLabels.some((label) => /benchmark|strategy|excess/i.test(label));
  const markerSignal = figure.figure_id.toLowerCase().includes("benchmark") || figure.figure_id.toLowerCase().includes("relative");
  return titleSignal || labelSignal || markerSignal;
}

function addBaseline(adapted: AdaptedChart): AdaptedChart {
  const option = adapted.option as Record<string, unknown>;
  const yAxis = option.yAxis as Record<string, unknown> | undefined;

  if (yAxis && !yAxis.name && Array.isArray(option.series)) {
    yAxis.name = "Relative performance";
  }

  option.series = (Array.isArray(option.series) ? option.series : []).map((series) => ({
    ...series,
    markLine: {
      symbol: ["none", "none"],
      lineStyle: { color: "rgba(100,116,139,0.55)", type: "dashed" },
      data: [{ yAxis: 0, name: "Baseline" }],
      label: { show: false },
    },
  }));

  option.title = {
    ...(typeof option.title === "object" && option.title ? option.title : {}),
    subtext: (typeof option.title === "object" && option.title && "subtext" in option.title && typeof option.title.subtext === "string" && option.title.subtext.length > 0)
      ? option.title.subtext
      : "Benchmark-relative comparison view",
  };

  return { ...adapted, option };
}

export const benchmarkRelativeAdapter: FigureTypeAdapter = (context) => {
  const labels = context.series.map((item) => item.label);
  if (!isBenchmarkRelativeFigure(context.figure, labels)) return undefined;

  const base = context.figure.type === "bar" || context.figure.type === "grouped_bar"
    ? barAdapter(context)
    : lineAdapter(context);

  if (!base) return undefined;
  return addBaseline(base);
};
