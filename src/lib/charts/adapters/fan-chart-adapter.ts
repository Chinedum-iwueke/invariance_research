import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { parsePercentileToken, resolveAxisMeta } from "./utils";

export const fanChartAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;

  const byPercentile = series
    .map((item) => ({ item, percentile: parsePercentileToken(`${item.label} ${item.key}`) }))
    .filter((entry): entry is { item: (typeof series)[number]; percentile: number } => entry.percentile !== undefined)
    .sort((a, b) => a.percentile - b.percentile);

  if (!byPercentile.length) return undefined;

  const axisMeta = resolveAxisMeta(series);
  const option = buildBaseOption(figure);
  const allPercentiles = new Map(byPercentile.map((entry) => [entry.percentile, entry.item]));

  const bands = [
    { low: 5, high: 95, color: "rgba(11,47,122,0.12)" },
    { low: 10, high: 90, color: "rgba(11,47,122,0.17)" },
    { low: 25, high: 75, color: "rgba(11,47,122,0.24)" },
  ].filter((band) => allPercentiles.has(band.low) && allPercentiles.has(band.high));

  const chartSeries: Array<Record<string, unknown>> = [];

  bands.forEach((band) => {
    const lowSeries = allPercentiles.get(band.low);
    const highSeries = allPercentiles.get(band.high);
    if (!lowSeries || !highSeries) return;

    const lowValues = axisMeta.categories.map((x) => axisMeta.bySeries.get(lowSeries.key)?.get(x) ?? null);
    const rangeValues = axisMeta.categories.map((x) => {
      const low = axisMeta.bySeries.get(lowSeries.key)?.get(x);
      const high = axisMeta.bySeries.get(highSeries.key)?.get(x);
      if (typeof low !== "number" || typeof high !== "number") return null;
      return high - low;
    });

    chartSeries.push({
      name: `P${band.low}`,
      type: "line",
      stack: `band-${band.low}-${band.high}`,
      data: lowValues,
      lineStyle: { opacity: 0 },
      symbol: "none",
      tooltip: { show: false },
    });
    chartSeries.push({
      name: `P${band.high}`,
      type: "line",
      stack: `band-${band.low}-${band.high}`,
      data: rangeValues,
      lineStyle: { opacity: 0 },
      symbol: "none",
      areaStyle: { color: band.color },
      z: 1,
      tooltip: { show: false },
    });
  });

  const medianSeries = allPercentiles.get(50) ?? byPercentile[Math.floor(byPercentile.length / 2)]?.item;
  if (medianSeries) {
    chartSeries.push({
      name: medianSeries.label,
      type: "line",
      smooth: false,
      symbol: "none",
      lineStyle: { width: 2.4, color: "#0b2f7a" },
      itemStyle: { color: "#0b2f7a" },
      data: axisMeta.categories.map((x) => axisMeta.bySeries.get(medianSeries.key)?.get(x) ?? null),
      z: 3,
    });
  }

  option.legend = {
    show: true,
    top: 44,
    textStyle: { color: "#475569", fontSize: 11 },
    data: [medianSeries?.label ?? "Median", ...bands.map((band) => `P${band.low}-P${band.high}`)],
  };
  option.xAxis = {
    type: axisMeta.isCategoryAxis ? "category" : "value",
    name: figure.x_label ?? "Simulation step",
    nameLocation: "middle",
    nameGap: 42,
    axisLabel: { color: "#475569", hideOverlap: true },
    data: axisMeta.isCategoryAxis ? axisMeta.categories : undefined,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Equity",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.series = chartSeries as never;

  return {
    option,
    summary: series,
    note: figure.note,
    supportsLegend: true,
  };
};
