import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import type { BenchmarkMetadata, OverviewBenchmarkComparison } from "@/lib/diagnostics/overview/map-benchmark-payload";

function formatDate(value?: string): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function field(label: string, value: string | number | undefined) {
  return (
    <p>
      <span className="font-medium text-text-graphite">{label}:</span> {value ?? "N/A"}
    </p>
  );
}

function metadataGrid(metadata?: BenchmarkMetadata) {
  if (!metadata) {
    return <p className="text-sm text-text-neutral">No benchmark metadata was emitted for this run.</p>;
  }

  return (
    <div className="grid gap-2 text-sm text-text-neutral md:grid-cols-2">
      {field("Benchmark ID", metadata.benchmark_id)}
      {field("Source", metadata.benchmark_source)}
      {field("Library revision", metadata.library_revision)}
      {field("Benchmark frequency", metadata.benchmark_frequency)}
      {field("Comparison frequency", metadata.comparison_frequency)}
      {field("Alignment basis", metadata.alignment_basis)}
      {field("Normalization basis", metadata.normalization_basis)}
      {field("Window start", formatDate(metadata.comparison_window_start))}
      {field("Window end", formatDate(metadata.comparison_window_end))}
      {field("Point count", metadata.point_count)}
    </div>
  );
}

export function BenchmarkMetadataPanel({ benchmark }: { benchmark: OverviewBenchmarkComparison }) {
  return (
    <WorkspaceCard title="Benchmark comparison context" subtitle="Comparison basis for reproducibility.">
      {metadataGrid(benchmark.metadata)}
    </WorkspaceCard>
  );
}
