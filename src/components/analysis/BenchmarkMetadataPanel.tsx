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

function sectionList(items: string[], emptyState: string) {
  if (!items.length) return <p className="mt-1 text-xs text-text-neutral">{emptyState}</p>;
  return (
    <ul className="mt-1 space-y-1 text-sm text-text-neutral">
      {items.map((item, index) => <li key={`${item.slice(0, 20)}-${index}`}>• {item}</li>)}
    </ul>
  );
}

export function BenchmarkMetadataPanel({ benchmark }: { benchmark: OverviewBenchmarkComparison }) {
  return (
    <WorkspaceCard title="Benchmark comparison context" subtitle="Comparison basis, assumptions, and limitations for reproducibility.">
      <div className="space-y-4">
        {metadataGrid(benchmark.metadata)}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-text-graphite">Assumptions</p>
            {sectionList(benchmark.assumptions, "No benchmark assumptions were emitted.")}
          </div>
          <div>
            <p className="text-sm font-medium text-text-graphite">Limitations</p>
            {sectionList(benchmark.limitations, "No benchmark limitations were emitted.")}
          </div>
        </div>
      </div>
    </WorkspaceCard>
  );
}
