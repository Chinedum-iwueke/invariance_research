import type { ChartSeries, FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { denseCategoryAxisLabel, resolveAxisMeta } from "./utils";

const PALETTE = ["#b00020", "#235a97", "#24734d", "#a66400", "#485c78"];

export const lineAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;
  const axisMeta = resolveAxisMeta(series);
  const option = buildBaseOption(figure);

  const chartSeries: ChartSeries[] = series.map((item, index) => ({
    name: item.label,
    type: "line" as const,
    smooth: false,
    symbol: "circle",
    symbolSize: 4,
    showSymbol: false,
    emphasis: { focus: "series" },
    lineStyle: { width: index === 0 ? 2.6 : 2, color: PALETTE[index % PALETTE.length] },
    itemStyle: { color: PALETTE[index % PALETTE.length] },
    data: axisMeta.categories.map((x) => axisMeta.bySeries.get(item.key)?.get(x) ?? null),
  }));

  option.legend = {
    show: series.length > 1,
    top: 44,
    type: "scroll",
    itemWidth: 11,
    textStyle: { color: "#56504c", fontSize: 11, fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui" },
  };
  option.xAxis = {
    type: axisMeta.isCategoryAxis ? "category" : "value",
    name: figure.x_label ?? "X axis",
    nameLocation: "middle",
    nameGap: 50,
    axisLabel: axisMeta.isCategoryAxis ? denseCategoryAxisLabel(axisMeta.categories.length) : { color: "#56504c", margin: 12 },
    data: axisMeta.isCategoryAxis ? axisMeta.categories : undefined,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Value",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#56504c", margin: 12 },
    splitLine: { lineStyle: { color: "#e6e0d9" } },
  };
  option.series = chartSeries;

  return {
    option,
    summary: series,
    note: figure.note,
    supportsLegend: series.length > 1,
  };
};
