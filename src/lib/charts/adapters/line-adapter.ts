import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { resolveAxisMeta } from "./utils";

const PALETTE = ["#356ae6", "#009966", "#9747ff", "#e45c34", "#0087a3"];

export const lineAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;
  const axisMeta = resolveAxisMeta(series);
  const option = buildBaseOption(figure);

  const chartSeries = series.map((item, index) => ({
    name: item.label,
    type: "line",
    smooth: false,
    symbol: "circle",
    symbolSize: 5,
    showSymbol: false,
    emphasis: { focus: "series" },
    lineStyle: { width: 2.2, color: PALETTE[index % PALETTE.length] },
    itemStyle: { color: PALETTE[index % PALETTE.length] },
    data: axisMeta.categories.map((x) => axisMeta.bySeries.get(item.key)?.get(x) ?? null),
  }));

  option.legend = {
    show: series.length > 1,
    top: 44,
    type: "scroll",
    itemWidth: 11,
    textStyle: { color: "#475569", fontSize: 11 },
  };
  option.xAxis = {
    type: axisMeta.isCategoryAxis ? "category" : "value",
    name: figure.x_label ?? "X axis",
    nameLocation: "middle",
    nameGap: 42,
    axisLabel: { color: "#475569", hideOverlap: true },
    data: axisMeta.isCategoryAxis ? axisMeta.categories : undefined,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Value",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.25)" } },
  };
  option.series = chartSeries;

  return {
    option,
    summary: series,
    note: figure.note,
    supportsLegend: series.length > 1,
  };
};
