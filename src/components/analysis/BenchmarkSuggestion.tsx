import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

type BenchmarkSuggestionProps = {
  suggestedId: BenchmarkId | null;
  reason: string;
};

export function BenchmarkSuggestion({ suggestedId, reason }: BenchmarkSuggestionProps) {
  return (
    <div className="rounded-md border border-border bg-surface-panel/50 p-3">
      <p className="text-xs uppercase tracking-wide text-text-neutral">Auto suggestion</p>
      <p className="mt-1 text-sm font-medium">Suggested benchmark: {suggestedId ?? "None"}</p>
      <p className="mt-1 text-xs text-text-neutral">{reason}</p>
    </div>
  );
}
