import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";

const PALETTE = ["#356ae6", "#009966", "#9747ff", "#e45c34", "#0087a3"];

export const scatterAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;

  const option = buildBaseOption(figure);
  option.legend = {
    show: series.length > 1,
    top: 44,
    itemWidth: 10,
    textStyle: { color: "#475569", fontSize: 11 },
  };
  option.xAxis = {
    type: "value",
    name: figure.x_label ?? "X axis",
    nameLocation: "middle",
    nameGap: 42,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Y axis",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.tooltip = {
    ...(option.tooltip ?? {}),
    trigger: "item",
  };

  option.series = series.map((item, index) => ({
    name: item.label,
    type: "scatter",
    symbolSize: 8,
    itemStyle: { color: PALETTE[index % PALETTE.length] },
    data: item.points
      .filter((point) => typeof point.x === "number")
      .map((point) => [point.x, point.y]),
  }));

  return {
    option,
    summary: series,
    note: figure.note,
    supportsLegend: series.length > 1,
  };
};
