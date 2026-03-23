"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { InsightRail } from "@/components/dashboard/insight-rail";
import type { InsightPoint } from "@/lib/app/analysis-ui";

const insightBySegment: Record<string, InsightPoint[]> = {
  overview: [
    { title: "Risk posture", body: "Robustness is moderate with non-trivial tail sensitivity.", tone: "warning" },
    { title: "Execution dependency", body: "Edge durability depends on maintaining baseline slippage conditions.", tone: "info" },
    { title: "Capital implication", body: "Position sizing should be conservative until further stability confirmation.", tone: "critical" },
  ],
  "monte-carlo": [
    { title: "Tail exposure", body: "Severe drawdown paths remain plausible under adverse sequencing.", tone: "critical" },
    { title: "Survivability", body: "Ruin probability is above ideal institutional comfort thresholds.", tone: "warning" },
    { title: "Policy note", body: "Use allocation limits and hard risk gates before capital expansion.", tone: "info" },
  ],
  report: [
    { title: "Report interpretation", body: "The strategy is viable with constraints, not fully robust under all stresses.", tone: "warning" },
    { title: "Governance", body: "Committee decisions should include explicit assumptions and invalidation triggers.", tone: "info" },
    { title: "Audit option", body: "Independent analyst review is recommended for mandate-critical deployment.", tone: "critical" },
  ],
};

const fallbackInsights: InsightPoint[] = [
  { title: "Interpretation", body: "Review diagnostics in sequence to understand fragility drivers.", tone: "info" },
  { title: "Caution", body: "Use conservative assumptions where uncertainty remains unresolved.", tone: "warning" },
];

export function AnalysisInsightRail() {
  const segment = useSelectedLayoutSegment() ?? "overview";
  const insights = insightBySegment[segment] ?? fallbackInsights;

  return <InsightRail insights={insights} />;
}
