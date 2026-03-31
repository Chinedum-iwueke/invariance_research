import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { denseCategoryAxisLabel, formatValue, resolveAxisMeta } from "./utils";

type HistogramBinDatum = {
  start?: number;
  end?: number;
  count: number;
  axisLabel: string;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function shortAxisNumber(value: number): string {
  if (Math.abs(value) >= 100) return `${Math.round(value)}`;
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function bucketAxisLabel(start?: number, end?: number): string {
  if (start === undefined && end === undefined) return "Bucket";
  if (start === undefined) return `≤${shortAxisNumber(end as number)}`;
  if (end === undefined) return `≥${shortAxisNumber(start)}`;
  return shortAxisNumber((start + end) / 2);
}

function toHistogramBins(figure: Parameters<FigureTypeAdapter>[0]["figure"]): HistogramBinDatum[] {
  const raw = figure as Parameters<FigureTypeAdapter>[0]["figure"] & Record<string, unknown>;
  const binsSource = Array.isArray(raw.bins) ? raw.bins : Array.isArray(raw.bucketed) ? raw.bucketed : Array.isArray(raw.buckets) ? raw.buckets : [];
  return binsSource.reduce<HistogramBinDatum[]>((acc, bin) => {
      if (!bin || typeof bin !== "object") return acc;
      const item = bin as Record<string, unknown>;
      const count = toNumber(item.count) ?? toNumber(item.frequency) ?? toNumber(item.y) ?? toNumber(item.value);
      if (count === undefined) return acc;
      const start = toNumber(item.start) ?? toNumber(item.low);
      const end = toNumber(item.end) ?? toNumber(item.high);
      acc.push({
        start,
        end,
        count,
        axisLabel: bucketAxisLabel(start, end),
      });
      return acc;
    }, []);
}

export const histogramAdapter: FigureTypeAdapter = ({ figure, series }) => {
  const bins = toHistogramBins(figure);
  const histogram = series[0] ?? (bins.length
    ? { key: "histogram", label: figure.title ?? "Histogram", series_type: "bar" as const, points: bins.map((bin, index) => ({ x: bin.axisLabel || index + 1, y: bin.count })) }
    : undefined);
  if (!histogram) return undefined;

  const axisMeta = resolveAxisMeta([histogram]);
  const option = buildBaseOption(figure);
  const categories = bins.length ? bins.map((bin) => bin.axisLabel) : axisMeta.categories;
  const maxHistogramTicks = categories.length > 60 ? 8 : categories.length > 36 ? 10 : 12;

  option.legend = { show: false };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "Bucket range",
    nameLocation: "middle",
    nameGap: 58,
    axisLabel: {
      ...denseCategoryAxisLabel(categories.length, maxHistogramTicks),
      rotate: categories.length >= 24 ? 35 : 0,
      width: categories.length >= 24 ? 44 : 66,
    },
    data: categories,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Frequency",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569", margin: 12 },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.series = [{
    name: histogram.label,
    type: "bar",
    barWidth: "80%",
    itemStyle: { color: "#356ae6", borderRadius: [3, 3, 0, 0] },
    data: bins.length
      ? bins.map((bin) => ({ value: bin.count, start: bin.start, end: bin.end, count: bin.count }))
      : axisMeta.categories.map((x) => axisMeta.bySeries.get(histogram.key)?.get(x) ?? null),
  }];
  option.tooltip = {
    ...(option.tooltip ?? {}),
    trigger: "item",
    formatter: (param) => {
      const row = Array.isArray(param) ? param[0] : param;
      const data = (row?.data ?? {}) as { value?: number; start?: number; end?: number; count?: number };
      if (!bins.length || data.count === undefined) {
        return `<div>${row?.marker ?? ""}${row?.seriesName ?? "Histogram"}: <b>${formatValue(Number(row?.value))}</b></div>`;
      }
      const start = typeof data.start === "number" ? data.start : undefined;
      const end = typeof data.end === "number" ? data.end : undefined;
      return [
        `<div style="margin-bottom:4px">${row?.name ?? "Bucket"}</div>`,
        `${row?.marker ?? ""}start: <b>${start !== undefined ? String(start) : "—"}</b>`,
        `end: <b>${end !== undefined ? String(end) : "—"}</b>`,
        `count: <b>${String(data.count)}</b>`,
      ].join("<br/>");
    },
  };

  const summary = series.length
    ? series
    : [{
        key: "histogram",
        label: figure.title ?? "Histogram",
        series_type: "bar" as const,
        points: [],
      }];

  return { option, summary, note: figure.note, supportsLegend: false };
};
