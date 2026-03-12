import type { InsightPoint } from "@/lib/mock/analysis";
import { cn } from "@/lib/utils";

const tones = {
  info: "border-chart-benchmark/25 bg-white",
  success: "border-chart-positive/25 bg-white",
  warning: "border-brand/25 bg-white",
  critical: "border-chart-negative/25 bg-white",
};

export function InsightCard({ insight }: { insight: InsightPoint }) {
  return (
    <article className={cn("rounded-sm border p-3", tones[insight.tone ?? "info"])}>
      <h4 className="text-sm font-semibold">{insight.title}</h4>
      <p className="mt-1 text-sm text-text-neutral">{insight.body}</p>
    </article>
  );
}
