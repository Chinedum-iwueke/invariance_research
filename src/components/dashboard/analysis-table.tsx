import Link from "next/link";
import type { AnalysisListItem } from "@/lib/contracts";
import { AnalysisStatusBadge } from "@/components/dashboard/analysis-status-badge";
import { buttonVariants } from "@/components/ui/button";

function robustnessLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "Pending";
  return String(value);
}

export function AnalysisTable({ analyses }: { analyses: AnalysisListItem[] }) {
  return (
    <div className="space-y-3">
      {analyses.map((analysis) => (
        <article key={analysis.analysis_id} className="artifact-surface grid gap-5 rounded-md border border-border-subtle bg-surface-white p-4 shadow-sm xl:grid-cols-[1fr_260px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AnalysisStatusBadge status={analysis.status} />
              <span className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{analysis.created_at}</span>
            </div>
            <h3 className="font-display mt-3 text-2xl font-medium leading-none text-text-institutional">{analysis.strategy_name}</h3>
            <div className="mt-4 grid gap-3 text-xs text-text-neutral sm:grid-cols-2 lg:grid-cols-4">
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2">Trades <strong className="block text-sm text-text-graphite">{analysis.trade_count}</strong></span>
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2">Timeframe <strong className="block text-sm text-text-graphite">{analysis.timeframe}</strong></span>
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2">Asset <strong className="block text-sm text-text-graphite">{analysis.asset}</strong></span>
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2">Robustness <strong className="block text-sm text-text-graphite">{robustnessLabel(analysis.robustness_score)}</strong></span>
            </div>
            <p className="mt-3 text-xs leading-5 text-text-neutral">
              Workbench opens the falsification path: overview, execution, distribution, path stress, capital survival, regime, stability, assumptions, and report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
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
