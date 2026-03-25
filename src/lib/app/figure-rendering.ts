import type { FigurePayload, FigureSeries } from "@/lib/contracts";

const SUPPORTED_TYPES = new Set(["line", "area", "bar", "grouped_bar", "histogram", "heatmap", "scatter", "fan", "fan_chart"]);

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | undefined {
  return value && typeof value === "object" ? value as LooseRecord : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toPoint(point: unknown, index: number): { x: string | number; y: number } | undefined {
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

function seriesFromPoints(seriesLike: unknown, keyFallback: string): FigureSeries | undefined {
  const item = asRecord(seriesLike);
  if (!item) return undefined;
  const pointsSource = Array.isArray(item.points)
    ? item.points
    : Array.isArray(item.data)
      ? item.data
      : Array.isArray(item.values)
        ? item.values
        : [];
  const points = pointsSource.map((point, index) => toPoint(point, index)).filter((point): point is { x: string | number; y: number } => Boolean(point));
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

function normalizeStandardSeries(figure: FigurePayload): FigureSeries[] {
  return figure.series
    .map((series, index) => seriesFromPoints(series as unknown, `${series.key || "series"}-${index}`))
    .filter((series): series is FigureSeries => Boolean(series));
}

function normalizeHistogramSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
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
        const x = typeof item.label === "string"
          ? item.label
          : typeof item.bucket === "string"
            ? item.bucket
            : toNumber(item.low) !== undefined && toNumber(item.high) !== undefined
              ? `${toNumber(item.low)}-${toNumber(item.high)}`
              : index + 1;
        return { x, y };
      })
      .filter((point): point is { x: string | number; y: number } => Boolean(point));
    if (points.length) return [{ key: "histogram", label: "Histogram", series_type: "bar", points }];
  }

  const edges = Array.isArray(raw.edges) ? raw.edges : Array.isArray(raw.bin_edges) ? raw.bin_edges : undefined;
  const counts = Array.isArray(raw.counts) ? raw.counts : Array.isArray(raw.bin_counts) ? raw.bin_counts : undefined;
  if (edges && counts && edges.length >= 2 && counts.length > 0) {
    const points = counts
      .map((count, index) => {
        const y = toNumber(count);
        if (y === undefined) return undefined;
        const left = edges[index];
        const right = edges[index + 1];
        const x = left !== undefined && right !== undefined ? `${left}-${right}` : index + 1;
        return { x, y };
      })
      .filter((point): point is { x: string | number; y: number } => Boolean(point));
    if (points.length) return [{ key: "histogram", label: "Histogram", series_type: "bar", points }];
  }

  return [];
}

function normalizeGroupedBarSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
  if (fallback.length) return fallback;
  const raw = figure as FigurePayload & LooseRecord;
  const categories = Array.isArray(raw.categories) ? raw.categories : undefined;
  const groups = Array.isArray(raw.groups) ? raw.groups : Array.isArray(raw.series) ? raw.series : undefined;
  if (categories && groups) {
    const mapped = groups
      .map((group, groupIndex) => {
        const entry = asRecord(group);
        if (!entry) return undefined;
        const values = Array.isArray(entry.values) ? entry.values : Array.isArray(entry.data) ? entry.data : undefined;
        if (!values) return undefined;
        const points = values
          .map((value, valueIndex) => {
            const y = toNumber(value);
            const x = categories[valueIndex];
            if (y === undefined || (typeof x !== "string" && typeof x !== "number")) return undefined;
            return { x, y };
          })
          .filter((point): point is { x: string | number; y: number } => Boolean(point));
        if (!points.length) return undefined;
        const key = typeof entry.key === "string" ? entry.key : `group_${groupIndex}`;
        const label = typeof entry.label === "string" ? entry.label : key;
        return { key, label, series_type: "bar" as const, points };
      })
      .filter((entry): entry is FigureSeries => Boolean(entry));
    if (mapped.length) return mapped;
  }

  const groupedPoints = Array.isArray(raw.values) ? raw.values : Array.isArray(raw.data) ? raw.data : undefined;
  if (groupedPoints) {
    const byGroup = new Map<string, Array<{ x: string | number; y: number }>>();
    groupedPoints.forEach((entry, index) => {
      const item = asRecord(entry);
      if (!item) return;
      const y = toNumber(item.y) ?? toNumber(item.value);
      const group = typeof item.group === "string" ? item.group : typeof item.series === "string" ? item.series : "group_1";
      const x = typeof item.category === "string" || typeof item.category === "number"
        ? item.category
        : typeof item.x === "string" || typeof item.x === "number"
          ? item.x
          : index + 1;
      if (y === undefined) return;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)?.push({ x, y });
    });

    const series = Array.from(byGroup.entries()).map(([group, points]) => ({ key: group, label: group, series_type: "bar" as const, points }));
    if (series.length) return series;
  }

  return [];
}

function normalizeFanSeries(figure: FigurePayload, fallback: FigureSeries[]): FigureSeries[] {
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

  const mapped = percentileSource
    .map((band, index) => {
      const entry = asRecord(band);
      if (!entry) return undefined;
      const percentile = toNumber(entry.percentile) ?? toNumber(entry.p);
      const key = percentile !== undefined ? `p${percentile}` : `band_${index}`;
      const label = percentile !== undefined ? `P${percentile}` : (typeof entry.label === "string" ? entry.label : key);
      const values = Array.isArray(entry.points) ? entry.points : Array.isArray(entry.path) ? entry.path : Array.isArray(entry.values) ? entry.values : undefined;
      if (!values) return undefined;
      const points = values.map((value, pointIndex) => toPoint(value, pointIndex)).filter((point): point is { x: string | number; y: number } => Boolean(point));
      if (!points.length) return undefined;
      return { key, label, series_type: "line" as const, points };
    })
    .filter((entry): entry is FigureSeries => Boolean(entry));

  return mapped;
}

export function getRenderableSeries(figure?: FigurePayload): { series: FigureSeries[]; rendererSupported: boolean; emptyReason?: string } {
  if (!figure) return { series: [], rendererSupported: false, emptyReason: "renderer received undefined figure" };
  const rendererSupported = SUPPORTED_TYPES.has(figure.type);
  if (!rendererSupported) {
    return { series: [], rendererSupported, emptyReason: `renderer does not support figure type ${figure.type}` };
  }

  const base = normalizeStandardSeries(figure);
  const series = figure.type === "histogram"
    ? normalizeHistogramSeries(figure, base)
    : figure.type === "grouped_bar"
      ? normalizeGroupedBarSeries(figure, base)
      : figure.type === "fan" || figure.type === "fan_chart"
        ? normalizeFanSeries(figure, base)
        : base;

  if (series.length === 0) {
    return { series, rendererSupported, emptyReason: `renderer found no renderable series for ${figure.type}` };
  }

  const pointCount = series.reduce((total, item) => total + item.points.length, 0);
  if (pointCount === 0) {
    return { series: [], rendererSupported, emptyReason: `renderer found no points for ${figure.type}` };
  }

  return { series, rendererSupported };
}

export function isFigureRenderable(figure?: FigurePayload): boolean {
  return getRenderableSeries(figure).series.length > 0;
}
