import type { TooltipComponentFormatterCallbackParams } from "echarts";
import type { FigurePayload, FigureSeries, FigurePoint } from "@/lib/contracts";
import type { AxisMeta } from "./types";

type LooseRecord = Record<string, unknown>;

export function asRecord(value: unknown): LooseRecord | undefined {
  return value && typeof value === "object" ? value as LooseRecord : undefined;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function toPoint(point: unknown, index: number): FigurePoint | undefined {
  if (Array.isArray(point) && point.length >= 2) {
    const y = toNumber(point[1]);
    const x = point[0];
    if (y === undefined || (typeof x !== "number" && typeof x !== "string")) return undefined;
    return { x, y };
  }

  const p = asRecord(point);
  if (!p) return undefined;
  const y = toNumber(p.y) ?? toNumber(p.value) ?? toNumber(p.count) ?? toNumber(p.frequency) ?? toNumber(p.v);
  if (y === undefined) return undefined;
  const x = typeof p.x === "number" || typeof p.x === "string"
    ? p.x
    : typeof p.label === "string"
      ? p.label
      : typeof p.bucket === "string"
        ? p.bucket
        : index + 1;
  return { x, y };
}

export function seriesFromPoints(seriesLike: unknown, keyFallback: string): FigureSeries | undefined {
  const item = asRecord(seriesLike);
  if (!item) return undefined;
  const pointsSource = Array.isArray(item.points)
    ? item.points
    : Array.isArray(item.data)
      ? item.data
      : Array.isArray(item.values)
        ? item.values
        : [];
  const points = pointsSource.map((point, index) => toPoint(point, index)).filter((point): point is FigurePoint => Boolean(point));
  if (!points.length) return undefined;
  const key = typeof item.key === "string" ? item.key : keyFallback;
  const label = typeof item.label === "string"
    ? item.label
    : typeof item.name === "string"
      ? item.name
      : key;
  const series_type = item.series_type === "line" || item.series_type === "area" || item.series_type === "bar" || item.series_type === "scatter"
    ? item.series_type
    : "line";
  return { key, label, series_type, points };
}

export function normalizeStandardSeries(figure: FigurePayload): FigureSeries[] {
  return figure.series
    .map((series, index) => seriesFromPoints(series as unknown, `${figure.figure_id || "series"}-${index}`))
    .filter((series): series is FigureSeries => Boolean(series));
}

export function normalizeHistogramSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
  if (fallback.length) return fallback;
  const raw = figure as FigurePayload & LooseRecord;
  const binsSource = Array.isArray(raw.bins) ? raw.bins : Array.isArray(raw.bucketed) ? raw.bucketed : Array.isArray(raw.buckets) ? raw.buckets : undefined;
  if (binsSource) {
    const points = binsSource
      .map((bin, index) => {
        const item = asRecord(bin);
        if (!item) return undefined;
        const y = toNumber(item.count) ?? toNumber(item.frequency) ?? toNumber(item.y) ?? toNumber(item.value);
        if (y === undefined) return undefined;
        const low = toNumber(item.low) ?? toNumber(item.start);
        const high = toNumber(item.high) ?? toNumber(item.end);
        const x = typeof item.label === "string"
          ? item.label
          : typeof item.bucket === "string"
            ? item.bucket
            : low !== undefined && high !== undefined
              ? `${low} - ${high}`
              : index + 1;
        return { x, y };
      })
      .filter((point): point is FigurePoint => Boolean(point));
    if (points.length) return [{ key: "histogram", label: "Histogram", series_type: "bar", points }];
  }

  const edges = Array.isArray(raw.edges) ? raw.edges : Array.isArray(raw.bin_edges) ? raw.bin_edges : undefined;
  const counts = Array.isArray(raw.counts) ? raw.counts : Array.isArray(raw.bin_counts) ? raw.bin_counts : undefined;
  if (edges && counts && edges.length >= 2 && counts.length > 0) {
    const points = counts.map((count, index) => {
      const y = toNumber(count);
      if (y === undefined) return undefined;
      return { x: `${edges[index]} - ${edges[index + 1]}`, y };
    }).filter((point): point is FigurePoint => Boolean(point));

    if (points.length) return [{ key: "histogram", label: "Histogram", series_type: "bar", points }];
  }

  return [];
}

export function normalizeGroupedBarSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
  if (fallback.length) return fallback;
  const raw = figure as FigurePayload & LooseRecord;
  const categories = Array.isArray(raw.categories) ? raw.categories : undefined;
  const groups = Array.isArray(raw.groups) ? raw.groups : undefined;

  if (categories && groups) {
    const mapped = groups
      .map((group, groupIndex) => {
        const entry = asRecord(group);
        if (!entry) return undefined;
        const values = Array.isArray(entry.values) ? entry.values : Array.isArray(entry.data) ? entry.data : undefined;
        if (!values) return undefined;
        const points = values.map((value, valueIndex) => {
          const y = toNumber(value);
          const x = categories[valueIndex];
          if (y === undefined || (typeof x !== "string" && typeof x !== "number")) return undefined;
          return { x, y };
        }).filter((point): point is FigurePoint => Boolean(point));

        if (!points.length) return undefined;
        const key = typeof entry.key === "string" ? entry.key : `group_${groupIndex}`;
        const label = typeof entry.label === "string" ? entry.label : key;
        return { key, label, series_type: "bar" as const, points };
      })
      .filter((entry): entry is FigureSeries => Boolean(entry));

    if (mapped.length) return mapped;
  }

  return [];
}

export function normalizeFanSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
  if (fallback.length) return fallback;
  const raw = figure as FigurePayload & LooseRecord;
  const percentileSource = Array.isArray(raw.percentile_bands)
    ? raw.percentile_bands
    : Array.isArray(raw.percentiles)
      ? raw.percentiles
      : Array.isArray(raw.bands)
        ? raw.bands
        : undefined;

  if (!percentileSource) return [];

  return percentileSource
    .map((band, index) => {
      const entry = asRecord(band);
      if (!entry) return undefined;
      const percentile = toNumber(entry.percentile) ?? toNumber(entry.p);
      const key = percentile !== undefined ? `p${percentile}` : `band_${index}`;
      const label = percentile !== undefined ? `P${percentile}` : (typeof entry.label === "string" ? entry.label : key);
      const values = Array.isArray(entry.points) ? entry.points : Array.isArray(entry.path) ? entry.path : Array.isArray(entry.values) ? entry.values : undefined;
      if (!values) return undefined;
      const points = values.map((value, pointIndex) => toPoint(value, pointIndex)).filter((point): point is FigurePoint => Boolean(point));
      if (!points.length) return undefined;
      return { key, label, series_type: "line" as const, points };
    })
    .filter((entry): entry is FigureSeries => Boolean(entry));
}

export function normalizeFigureSeries(figure: FigurePayload): FigureSeries[] {
  const base = normalizeStandardSeries(figure);
  if (figure.type === "histogram") return normalizeHistogramSeries(figure, base);
  if (figure.type === "grouped_bar") return normalizeGroupedBarSeries(figure, base);
  if (figure.type === "fan" || figure.type === "fan_chart") return normalizeFanSeries(figure, base);
  return base;
}

export function resolveAxisMeta(series: FigureSeries[]): AxisMeta {
  const categories: Array<string | number> = [];
  const seen = new Set<string>();
  const bySeries = new Map<string, Map<string | number, number>>();
  let isCategoryAxis = false;

  series.forEach((item) => {
    const map = new Map<string | number, number>();
    item.points.forEach((point, index) => {
      if (typeof point.x === "string") isCategoryAxis = true;
      const key = String(point.x);
      if (!seen.has(key)) {
        seen.add(key);
        categories.push(point.x);
      }
      map.set(point.x, point.y);
      if (typeof point.x === "number" && !seen.has(String(index))) {
        // no-op: keeps insertion order from explicit x values
      }
    });
    bySeries.set(item.key, map);
  });

  if (!isCategoryAxis) {
    categories.sort((a, b) => Number(a) - Number(b));
  }

  return { categories, isCategoryAxis, bySeries };
}

export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  if (Math.abs(value) >= 1) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(value);
}

export function tooltipRows(params: TooltipComponentFormatterCallbackParams | TooltipComponentFormatterCallbackParams[]): string {
  const rows = Array.isArray(params) ? params : [params];
  if (!rows.length) return "No datapoint";
  const axis = rows[0]?.axisValueLabel ?? String(rows[0]?.name ?? "");
  const lines = rows.map((row) => {
    const value = Array.isArray(row.value) ? row.value[row.value.length - 1] : row.value;
    const numeric = typeof value === "number" ? value : toNumber(value);
    return `${row.marker}${row.seriesName}: <b>${numeric !== undefined ? formatValue(numeric) : "—"}</b>`;
  }).join("<br/>");
  return `<div><div style=\"margin-bottom:4px\">${axis}</div>${lines}</div>`;
}

export function parsePercentileToken(value: string): number | undefined {
  const match = value.toLowerCase().match(/(?:^|[^0-9])(p?\s?(\d{1,2}|100))(?:[^0-9]|$)/);
  if (!match?.[1]) return undefined;
  const normalized = Number(match[1].replace("p", "").trim());
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 100 ? normalized : undefined;
}
