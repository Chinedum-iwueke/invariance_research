import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { resolveAxisMeta } from "./utils";

const PALETTE = ["#356ae6", "#009966", "#9747ff", "#e45c34", "#0087a3"];

export const barAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;

  const axisMeta = resolveAxisMeta(series);
  const option = buildBaseOption(figure);

  option.legend = {
    show: series.length > 1,
    top: 44,
    itemWidth: 10,
    textStyle: { color: "#475569", fontSize: 11 },
  };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "Category",
    nameLocation: "middle",
    nameGap: 44,
    axisLabel: { color: "#475569", hideOverlap: true },
    data: axisMeta.categories,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Value",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.series = series.map((item, index) => ({
    name: item.label,
    type: "bar",
    itemStyle: { color: PALETTE[index % PALETTE.length], borderRadius: [3, 3, 0, 0] },
    emphasis: { focus: "series" },
    data: axisMeta.categories.map((x) => axisMeta.bySeries.get(item.key)?.get(x) ?? null),
  }));

  return { option, summary: series, note: figure.note, supportsLegend: series.length > 1 };
};
