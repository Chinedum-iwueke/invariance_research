import type { FigurePayload } from "@/lib/contracts";

type LooseRecord = Record<string, unknown>;

export interface BenchmarkSummaryMetrics {
  benchmark_selected?: string;
  strategy_return?: number;
  benchmark_return?: number;
  excess_return_vs_benchmark?: number;
}

export interface BenchmarkMetadata {
  benchmark_id?: string;
  benchmark_source?: string;
  library_revision?: string;
  benchmark_frequency?: string;
  comparison_frequency?: string;
  alignment_basis?: string;
  normalization_basis?: string;
  comparison_window_start?: string;
  comparison_window_end?: string;
  point_count?: number;
}

export interface OverviewBenchmarkComparison {
  available: boolean;
  limited: boolean;
  reason?: string;
  reason_label?: string;
  summary_metrics?: BenchmarkSummaryMetrics;
  metadata?: BenchmarkMetadata;
  assumptions: string[];
  limitations: string[];
  figure?: FigurePayload;
}

function asRecord(value: unknown): LooseRecord | undefined {
  return value && typeof value === "object" ? (value as LooseRecord) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((item): item is string => Boolean(item));
}

function toSeries(rawSeries: unknown): FigurePayload["series"] {
  if (!Array.isArray(rawSeries)) return [];

  return rawSeries
    .map((item, index) => {
      const series = asRecord(item);
      if (!series) return undefined;
      const id = asString(series.id) ?? asString(series.key) ?? `series_${index}`;
      const label = asString(series.label) ?? id;
      const pointsSource = Array.isArray(series.points) ? series.points : [];
      const points = pointsSource
        .map((point) => {
          if (Array.isArray(point) && point.length >= 2) {
            const x = point[0];
            const y = asNumber(point[1]);
            if ((typeof x === "number" || typeof x === "string") && y !== undefined) {
              return { x, y };
            }
          }

          const shaped = asRecord(point);
          if (!shaped) return undefined;
          const x = shaped.x;
          const y = asNumber(shaped.y);
          if ((typeof x === "number" || typeof x === "string") && y !== undefined) {
            return { x, y };
          }
          return undefined;
        })
        .filter((point): point is { x: string | number; y: number } => Boolean(point));

      if (!points.length) return undefined;
      return {
        key: id,
        label,
        series_type: "line" as const,
        points,
      };
    })
    .filter((series): series is NonNullable<typeof series> => Boolean(series));
}

function toFigure(rawFigure: unknown, metadata?: BenchmarkMetadata): FigurePayload | undefined {
  const figure = asRecord(rawFigure);
  if (!figure) return undefined;

  const type = asString(figure.type) ?? "timeseries_overlay";
  const series = toSeries(figure.series);
  if (!series.length) return undefined;

  return {
    figure_id: "overview-benchmark-comparison",
    title: asString(figure.title) ?? "Strategy vs Benchmark",
    subtitle: "Daily normalized comparison (100 at first common timestamp)",
    type: "line",
    series,
    x_label: metadata?.comparison_frequency ? `Time (${metadata.comparison_frequency})` : "Time",
    y_label: "Normalized value",
    note: type !== "timeseries_overlay" ? `Engine figure type: ${type}` : undefined,
    provenance: "engine_native",
  };
}

export function benchmarkReasonLabel(reason?: string): string | undefined {
  if (!reason) return undefined;
  const mapping: Record<string, string> = {
    benchmark_disabled: "Benchmark comparison disabled",
    benchmark_not_configured: "Benchmark not configured",
    invalid_benchmark_config: "Invalid benchmark configuration",
    benchmark_dataset_load_failed: "Benchmark dataset unavailable",
    no_benchmark_overlap: "No overlapping benchmark data",
    insufficient_aligned_points: "Insufficient comparison data",
  };

  if (mapping[reason]) return mapping[reason];
  return reason.replace(/_/g, " ").replace(/\b\w/g, (token) => token.toUpperCase());
}

export function mapOverviewBenchmarkPayload(overviewPayload: unknown): OverviewBenchmarkComparison | undefined {
  const overview = asRecord(overviewPayload);
  const comparison = asRecord(overview?.benchmark_comparison);
  if (!comparison) return undefined;

  const available = asBoolean(comparison.available);
  const limited = asBoolean(comparison.limited, !available);
  const reason = asString(comparison.reason);

  const rawSummary = asRecord(comparison.summary_metrics);
  const summary_metrics: BenchmarkSummaryMetrics | undefined = rawSummary
    ? {
      benchmark_selected: asString(rawSummary.benchmark_selected),
      strategy_return: asNumber(rawSummary.strategy_return),
      benchmark_return: asNumber(rawSummary.benchmark_return),
      excess_return_vs_benchmark: asNumber(rawSummary.excess_return_vs_benchmark),
    }
    : undefined;

  const rawMetadata = asRecord(comparison.metadata);
  const metadata: BenchmarkMetadata | undefined = rawMetadata
    ? {
      benchmark_id: asString(rawMetadata.benchmark_id),
      benchmark_source: asString(rawMetadata.benchmark_source),
      library_revision: asString(rawMetadata.library_revision),
      benchmark_frequency: asString(rawMetadata.benchmark_frequency),
      comparison_frequency: asString(rawMetadata.comparison_frequency),
      alignment_basis: asString(rawMetadata.alignment_basis),
      normalization_basis: asString(rawMetadata.normalization_basis),
      comparison_window_start: asString(rawMetadata.comparison_window_start),
      comparison_window_end: asString(rawMetadata.comparison_window_end),
      point_count: asNumber(rawMetadata.point_count),
    }
    : undefined;

  return {
    available,
    limited,
    reason,
    reason_label: benchmarkReasonLabel(reason),
    summary_metrics,
    metadata,
    assumptions: asStringArray(comparison.assumptions),
    limitations: asStringArray(comparison.limitations),
    figure: toFigure(comparison.figure, metadata),
  };
}
