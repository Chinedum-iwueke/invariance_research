import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalysisContext } from "@/lib/mock/analysis";

export function AppTopbar({ context }: { context?: AnalysisContext }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        {context ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-neutral">
            <span className="rounded-sm border bg-surface-panel px-2 py-1 text-text-graphite">{context.strategy_name}</span>
            <span>Trades: {context.trade_count}</span>
            <span>•</span>
            <span>{context.timeframe}</span>
            <span>•</span>
            <span>{context.asset}</span>
            <span>•</span>
            <span>Status: {context.analysis_status}</span>
            <span className="rounded-sm border border-brand/20 bg-brand/5 px-2 py-1 text-brand">Robustness {context.robustness_score}</span>
          </div>
        ) : (
          <p className="text-sm text-text-neutral">Authenticated research workspace</p>
        )}

        <div className="flex items-center gap-2">
          <button className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>Export</button>
          <button className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>Upgrade</button>
          <button className={cn(buttonVariants({ size: "sm" }))}>Request Audit</button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
