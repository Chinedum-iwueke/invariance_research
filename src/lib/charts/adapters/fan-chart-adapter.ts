import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { denseCategoryAxisLabel, formatValue, parsePercentileToken, resolveAxisMeta, toNumber } from "./utils";

type FanBandKey = "p5" | "p25" | "p50" | "p75" | "p95";

function readBandsFromPersistedPayload(figure: Parameters<FigureTypeAdapter>[0]["figure"]): { x: Array<number | string>; values: Partial<Record<FanBandKey, Array<number | null>>> } | undefined {
  const raw = figure as Parameters<FigureTypeAdapter>[0]["figure"] & Record<string, unknown>;
  const x = Array.isArray(raw.x) ? raw.x.filter((value): value is number | string => typeof value === "number" || typeof value === "string") : [];
  const bands = raw.bands;
  if (!x.length || !bands || typeof bands !== "object" || Array.isArray(bands)) return undefined;
  const bandRecord = bands as Record<string, unknown>;
  const values: Partial<Record<FanBandKey, Array<number | null>>> = {};
  (["p5", "p25", "p50", "p75", "p95"] as const).forEach((key) => {
    if (!Array.isArray(bandRecord[key])) return;
    const normalized = x.map((_, index) => {
      const numeric = toNumber((bandRecord[key] as unknown[])[index]);
      return numeric === undefined ? null : numeric;
    });
    if (normalized.some((value) => typeof value === "number")) values[key] = normalized;
  });
  return Object.keys(values).length ? { x, values } : undefined;
}

export const fanChartAdapter: FigureTypeAdapter = ({ figure, series }) => {
  const persisted = readBandsFromPersistedPayload(figure);

  if (persisted) {
    const option = buildBaseOption(figure);
    const xAxisData = persisted.x;
    const p5 = persisted.values.p5;
    const p25 = persisted.values.p25;
    const p50 = persisted.values.p50;
    const p75 = persisted.values.p75;
    const p95 = persisted.values.p95;

    option.tooltip = {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.95)",
      borderWidth: 0,
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        const index = typeof rows[0]?.dataIndex === "number" ? rows[0].dataIndex : 0;
        const at = (values?: Array<number | null>) => values?.[index];
        const show = (label: string, value?: number | null) => `${label}: <b>${typeof value === "number" ? formatValue(value) : "—"}</b>`;
        return [
          `<div style=\"margin-bottom:4px\">${String(xAxisData[index] ?? rows[0]?.axisValueLabel ?? "")}</div>`,
          show("P5", at(p5)),
          show("P25", at(p25)),
          show("P50", at(p50)),
          show("P75", at(p75)),
          show("P95", at(p95)),
        ].join("<br/>");
      },
    };
    option.legend = {
      show: true,
      top: 44,
      textStyle: { color: "#475569", fontSize: 11 },
      data: ["P50 (Median)", "P25–P75", "P5–P95"],
    };
    option.xAxis = {
      type: typeof xAxisData[0] === "string" ? "category" : "value",
      name: figure.x_label ?? "Simulation step",
      nameLocation: "middle",
      nameGap: 50,
      axisLabel: typeof xAxisData[0] === "string" ? denseCategoryAxisLabel(xAxisData.length) : { color: "#475569", margin: 12 },
      data: typeof xAxisData[0] === "string" ? xAxisData : undefined,
    };
    option.yAxis = {
      type: "value",
      name: figure.y_label ?? "Equity",
      nameLocation: "middle",
      nameGap: 52,
      axisLabel: { color: "#475569", margin: 12 },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
    };

    const chartSeries: Array<Record<string, unknown>> = [];
    if (p5 && p95) {
      chartSeries.push({ name: "P5", type: "line", stack: "outer", data: p5, lineStyle: { opacity: 0 }, symbol: "none", tooltip: { show: false } });
      chartSeries.push({ name: "P5–P95", type: "line", stack: "outer", data: p95.map((high, idx) => (typeof high === "number" && typeof p5[idx] === "number") ? high - (p5[idx] as number) : null), lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "rgba(11,47,122,0.12)" }, tooltip: { show: false }, z: 1 });
    }
    if (p25 && p75) {
      chartSeries.push({ name: "P25", type: "line", stack: "inner", data: p25, lineStyle: { opacity: 0 }, symbol: "none", tooltip: { show: false } });
      chartSeries.push({ name: "P25–P75", type: "line", stack: "inner", data: p75.map((high, idx) => (typeof high === "number" && typeof p25[idx] === "number") ? high - (p25[idx] as number) : null), lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "rgba(11,47,122,0.24)" }, tooltip: { show: false }, z: 2 });
    }
    if (p50) {
      chartSeries.push({ name: "P50 (Median)", type: "line", data: p50, smooth: false, symbol: "none", lineStyle: { width: 2.4, color: "#0b2f7a" }, itemStyle: { color: "#0b2f7a" }, z: 3 });
    }

    option.series = chartSeries as never;
    return {
      option,
      summary: (["p5", "p25", "p50", "p75", "p95"] as const)
        .filter((key) => Boolean(persisted.values[key]?.length))
        .map((key) => ({ key, label: key.toUpperCase(), series_type: "line" as const, points: [] })),
      note: figure.note,
      supportsLegend: true,
    };
  }

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
    nameGap: 50,
    axisLabel: axisMeta.isCategoryAxis ? denseCategoryAxisLabel(axisMeta.categories.length) : { color: "#475569", margin: 12 },
    data: axisMeta.isCategoryAxis ? axisMeta.categories : undefined,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Equity",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569", margin: 12 },
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
