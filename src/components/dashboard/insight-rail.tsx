import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InsightCard } from "@/components/dashboard/insight-card";
import type { InsightPoint } from "@/lib/mock/analysis";

interface InsightRailProps {
  title?: string;
  insights: InsightPoint[];
}

export function InsightRail({ title = "Analyst Commentary", insights }: InsightRailProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
      <div className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.title} insight={insight} />
        ))}
      </div>
      <div className="rounded-sm border bg-white p-3">
        <p className="text-sm font-semibold">Need a full independent validation?</p>
        <p className="mt-1 text-xs text-text-neutral">Commission analyst review for deeper stress-testing, governance-grade reporting, and execution interpretation.</p>
        <a href="/contact" className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full") }>Request Professional Audit</a>
      </div>
    </div>
  );
}
