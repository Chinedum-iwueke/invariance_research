import React from "react";
import { BenchmarkMetadataPanel } from "@/components/analysis/BenchmarkMetadataPanel";
import { StrategyVsBenchmarkChart } from "@/components/analysis/StrategyVsBenchmarkChart";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { OverviewBenchmarkCards } from "@/components/diagnostics/overview/OverviewBenchmarkCards";
import type { OverviewBenchmarkComparison } from "@/lib/diagnostics/overview/map-benchmark-payload";

function UnavailablePanel({ benchmark }: { benchmark: OverviewBenchmarkComparison }) {
  return (
    <WorkspaceCard title="Benchmark comparison" subtitle="Benchmark comparison unavailable for this run.">
      <div className="space-y-2 text-sm text-text-neutral">
        <p className="font-medium text-text-graphite">{benchmark.reason_label ?? "Benchmark comparison unavailable"}</p>
        {benchmark.limitations.length ? (
          <ul className="space-y-1">
            {benchmark.limitations.map((item, index) => <li key={`${item.slice(0, 24)}-${index}`}>• {item}</li>)}
          </ul>
        ) : (
          <p>No additional limitation details were emitted.</p>
        )}
      </div>
    </WorkspaceCard>
  );
}

export function OverviewBenchmarkSection({ benchmark }: { benchmark?: OverviewBenchmarkComparison }) {
  if (!benchmark) return null;

  if (!benchmark.available) {
    return <UnavailablePanel benchmark={benchmark} />;
  }

  return (
    <section className="space-y-5">
      <WorkspaceCard title="Benchmark comparison" subtitle="Daily normalized strategy-versus-benchmark comparison.">
        <OverviewBenchmarkCards benchmark={benchmark} />
      </WorkspaceCard>
      <StrategyVsBenchmarkChart benchmark={benchmark} />
      <BenchmarkMetadataPanel benchmark={benchmark} />
    </section>
  );
}
