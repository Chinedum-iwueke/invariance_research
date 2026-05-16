import Link from "next/link";
import type { AnalysisListItem } from "@/lib/contracts";
import { AnalysisStatusBadge } from "@/components/dashboard/analysis-status-badge";
import { buttonVariants } from "@/components/ui/button";

export function AnalysisTable({ analyses }: { analyses: AnalysisListItem[] }) {
  return (
    <div className="space-y-3">
      {analyses.map((analysis) => (
        <article key={analysis.analysis_id} className="artifact-surface grid gap-4 rounded-md border border-border-subtle bg-surface-white p-4 shadow-sm lg:grid-cols-[1fr_220px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AnalysisStatusBadge status={analysis.status} />
              <span className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{analysis.created_at}</span>
            </div>
            <h3 className="font-display mt-3 text-2xl font-medium leading-none text-text-institutional">{analysis.strategy_name}</h3>
            <div className="mt-3 grid gap-2 text-xs text-text-neutral sm:grid-cols-4">
              <span>Trades: <strong className="text-text-graphite">{analysis.trade_count}</strong></span>
              <span>Timeframe: <strong className="text-text-graphite">{analysis.timeframe}</strong></span>
              <span>Asset: <strong className="text-text-graphite">{analysis.asset}</strong></span>
              <span>Robustness: <strong className="text-text-graphite">{analysis.robustness_score}</strong></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {analysis.status === "completed" ? (
              <>
                <Link href={`/app/analyses/${analysis.analysis_id}/overview`} className={buttonVariants({ size: "sm" })}>Open workbench</Link>
                <Link href={`/app/analyses/${analysis.analysis_id}/report`} className={buttonVariants({ size: "sm", variant: "secondary" })}>Report</Link>
              </>
            ) : (
              <span className={buttonVariants({ size: "sm", variant: "secondary" })}>Awaiting result</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
