import { Card } from "@/components/ui/card";
import { EvidenceStatusBadge, type EvidenceState } from "@/components/dashboard/evidence-status";
import { cn } from "@/lib/utils";
import type { KeyMetric } from "@/lib/app/analysis-ui";

const toneClasses = {
  neutral: { value: "text-text-institutional", state: "unsupported" },
  positive: { value: "text-evidence-supported", state: "supported" },
  negative: { value: "text-evidence-contradicted", state: "contradicted" },
  warning: { value: "text-evidence-limited", state: "limited" },
} as const satisfies Record<NonNullable<KeyMetric["tone"]>, { value: string; state: EvidenceState }>;

function metricUnit(value: string) {
  if (/%$/.test(value.trim())) return "percent";
  if (/^[+-]?\d+(\.\d+)?$/.test(value.trim())) return "value";
  return "state";
}

export function MetricTile({ metric, source = "Diagnostic" }: { metric: KeyMetric; source?: string }) {
  const tone = metric.tone ?? "neutral";
  const toneClass = toneClasses[tone];
  const unit = metricUnit(metric.value);

  return (
    <Card className="relative overflow-hidden rounded-md border border-border-subtle bg-surface-paper p-0 shadow-none">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle bg-surface-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.11em] text-text-neutral">{metric.label}</p>
          <p className="font-provenance mt-1 text-[10px] uppercase tracking-[0.08em] text-text-muted">{source}</p>
        </div>
        <EvidenceStatusBadge state={toneClass.state} compact />
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <p className={cn("font-provenance text-[2.15rem] font-medium leading-none tracking-tight", toneClass.value)}>{metric.value}</p>
          <span className="rounded-sm border border-border-subtle px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-neutral">{unit}</span>
        </div>
        {metric.helper ? (
          <p className="min-h-8 border-t border-border-subtle pt-3 text-xs leading-relaxed text-text-neutral">{metric.helper}</p>
        ) : (
          <p className="min-h-8 border-t border-border-subtle pt-3 text-xs leading-relaxed text-text-neutral">No limitation note emitted.</p>
        )}
      </div>
    </Card>
  );
}
