import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { formatValue } from "./utils";

export const heatmapAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;

  const xCategories = Array.from(new Set(series.flatMap((item) => item.points.map((point) => String(point.x)))));
  const yCategories = series.map((item) => item.label);

  const matrix = series.flatMap((item, rowIndex) =>
    item.points.map((point) => [xCategories.indexOf(String(point.x)), rowIndex, point.y]));

  if (!matrix.length || !xCategories.length || !yCategories.length) return undefined;

  const values = matrix.map((entry) => entry[2] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const option = buildBaseOption(figure);
  option.grid = { left: 86, right: 50, top: 86, bottom: 64, containLabel: true };
  option.tooltip = {
    ...(option.tooltip ?? {}),
    trigger: "item",
    formatter: (params: { value?: [number, number, number] }) => {
      const [xIndex, yIndex, value] = params.value ?? [0, 0, 0];
      return `${yCategories[yIndex]}<br/>${xCategories[xIndex]}: <b>${formatValue(value)}</b>`;
    },
  };
  option.legend = { show: false };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "X axis",
    nameLocation: "middle",
    nameGap: 44,
    data: xCategories,
    axisLabel: { color: "#475569", hideOverlap: true },
  };
  option.yAxis = {
    type: "category",
    name: figure.y_label ?? "Series",
    nameLocation: "middle",
    nameGap: 58,
    data: yCategories,
    axisLabel: { color: "#475569" },
  };
  option.visualMap = {
    min,
    max,
    calculable: true,
    orient: "vertical",
    right: 6,
    top: "middle",
    inRange: {
      color: ["#f1f5f9", "#bae6fd", "#60a5fa", "#1d4ed8", "#0f172a"],
    },
    textStyle: { color: "#475569", fontSize: 10 },
  };
  option.series = [{
    name: figure.title,
    type: "heatmap",
    data: matrix,
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: "rgba(15,23,42,0.35)",
      },
    },
  }];

  return {
    option,
    summary: series,
    note: figure.note,
    supportsLegend: false,
  };
};
