import type { InsightPoint } from "@/lib/app/analysis-ui";
import { cn } from "@/lib/utils";

const toneMeta = {
  info: { chip: "Interpretation", wrap: "border-border-subtle" },
  success: { chip: "Stability Signal", wrap: "border-chart-positive/25" },
  warning: { chip: "Risk Warning", wrap: "border-brand/25" },
  critical: { chip: "Capital Implication", wrap: "border-chart-negative/25" },
} as const;

export function InsightCard({ insight }: { insight: InsightPoint }) {
  const tone = insight.tone ?? "info";
  return (
    <article className={cn("rounded-sm border bg-surface-white p-3", toneMeta[tone].wrap)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-neutral">{toneMeta[tone].chip}</p>
      <h4 className="mt-1 text-sm font-semibold text-text-institutional">{insight.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-text-neutral">{insight.body}</p>
    </article>
  );
}
