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
    <section className="space-y-4">
      <header className="space-y-1 border-b pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-neutral">Insight Rail</p>
        <h3 className="text-sm font-semibold text-text-institutional">{title}</h3>
      </header>
      <div className="space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.title} insight={insight} />
        ))}
      </div>
      <div className="rounded-sm border bg-white p-3">
        <p className="text-sm font-semibold">Need an independent validation audit?</p>
        <p className="mt-1 text-xs leading-relaxed text-text-neutral">
          Request analyst-led stress testing and report review for committee-level capital decisions.
        </p>
        <a href="/contact" className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full")}>
          Request Professional Audit
        </a>
      </div>
    </section>
  );
}
