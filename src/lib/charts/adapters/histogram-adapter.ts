import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { resolveAxisMeta } from "./utils";

export const histogramAdapter: FigureTypeAdapter = ({ figure, series }) => {
  const histogram = series[0];
  if (!histogram) return undefined;

  const axisMeta = resolveAxisMeta([histogram]);
  const option = buildBaseOption(figure);

  option.legend = { show: false };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "Bucket range",
    nameLocation: "middle",
    nameGap: 48,
    axisLabel: { interval: 0, color: "#475569", rotate: axisMeta.categories.length > 16 ? 40 : 0 },
    data: axisMeta.categories,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Frequency",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.series = [{
    name: histogram.label,
    type: "bar",
    barWidth: "80%",
    itemStyle: { color: "#356ae6", borderRadius: [3, 3, 0, 0] },
    data: axisMeta.categories.map((x) => axisMeta.bySeries.get(histogram.key)?.get(x) ?? null),
  }];

  return { option, summary: series, note: figure.note, supportsLegend: false };
};
