import type { ResearchMemorySnapshot } from "@/lib/server/research-memory/models";

function pretty(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not recorded";
}

export function ResearchMemoryPanel({ memory, compact = false }: { memory: ResearchMemorySnapshot; compact?: boolean }) {
  const items = compact ? memory.items.slice(0, 6) : memory.items;
  const recommendations = compact ? memory.recommendations.slice(0, 3) : memory.recommendations;
  const findings = compact ? memory.findings.slice(0, 3) : memory.findings;

  if (memory.items.length === 0 && memory.recommendations.length === 0 && memory.findings.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-subtle p-4 text-sm leading-6 text-text-neutral">
        No research memory has been recorded yet. Completed experiment verdict cards will be remembered here with tenant-scoped findings, recommendations, and similarity signatures.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Memory items</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{memory.items.length}</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Findings</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{memory.findings.length}</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Recommendations</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{memory.recommendations.length}</p>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Similar signatures</p>
          <p className="mt-2 text-2xl font-medium text-text-institutional">{memory.similar_runs.length}</p>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="rounded-md border border-border-subtle bg-surface-white p-4">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Next experiment recommendations</p>
          <div className="mt-3 space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.recommendation_id} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-institutional">{pretty(rec.recommendation_type)}</p>
                  <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[11px] text-text-neutral">{rec.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">{rec.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {findings.map((finding) => (
            <div key={finding.finding_id} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-institutional">{finding.headline}</p>
                <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[11px] text-text-neutral">{finding.severity}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-neutral">{finding.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-2">
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Remembered cards</p>
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((item) => (
              <div key={item.memory_item_id} className="rounded-md border border-border-subtle bg-surface-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-institutional">{item.title}</p>
                  <span className="rounded-sm border border-border-subtle bg-surface-subtle px-2 py-1 text-[11px] text-text-neutral">{pretty(item.memory_type)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">{item.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-sm border border-border-subtle bg-surface-subtle px-2 py-1 text-[11px] text-text-neutral">{pretty(tag)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
