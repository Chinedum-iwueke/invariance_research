import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { formatValue, resolveAxisMeta } from "./utils";

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

function compactBoundaryLabel(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

function bucketLabel(start?: number, end?: number): string {
  if (start === undefined && end === undefined) return "Unlabeled bucket";
  if (start === undefined) return `≤${compactBoundaryLabel(end as number)}`;
  if (end === undefined) return `≥${compactBoundaryLabel(start)}`;
  return `${compactBoundaryLabel(start)}–${compactBoundaryLabel(end)}`;
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
        axisLabel: bucketLabel(start, end),
      });
      return acc;
    }, []);
}

export const histogramAdapter: FigureTypeAdapter = ({ figure, series }) => {
  const histogram = series[0];
  if (!histogram) return undefined;

  const bins = toHistogramBins(figure);
  const axisMeta = resolveAxisMeta([histogram]);
  const option = buildBaseOption(figure);
  const categories = bins.length ? bins.map((bin) => bin.axisLabel) : axisMeta.categories;

  option.legend = { show: false };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "Bucket range",
    nameLocation: "middle",
    nameGap: 48,
    axisLabel: {
      color: "#475569",
      hideOverlap: true,
      interval: categories.length > 18 ? "auto" : 0,
      rotate: categories.length > 20 ? 45 : categories.length > 12 ? 25 : 0,
      formatter: (value: string) => value.length > 20 ? `${value.slice(0, 19)}…` : value,
    },
    data: categories,
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

  return { option, summary: series, note: figure.note, supportsLegend: false };
};
