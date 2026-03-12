import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalysisContext } from "@/lib/mock/analysis";

function MetaPill({ children }: { children: ReactNode }) {
  return <span className="rounded-sm border bg-white px-2 py-1 text-xs text-text-graphite">{children}</span>;
}

export function AppTopbar({ context }: { context?: AnalysisContext }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        {context ? (
          <div className="flex flex-wrap items-center gap-2">
            <MetaPill>{context.strategy_name}</MetaPill>
            <MetaPill>{context.trade_count} trades</MetaPill>
            <MetaPill>{context.timeframe}</MetaPill>
            <MetaPill>{context.asset}</MetaPill>
            <MetaPill>Status: {context.analysis_status}</MetaPill>
            <span className="rounded-sm border border-brand/20 bg-brand/5 px-2 py-1 text-xs font-medium text-brand">
              Robustness {context.robustness_score}
            </span>
          </div>
        ) : (
          <p className="text-sm text-text-neutral">Authenticated research workspace</p>
        )}

        <div className="flex items-center gap-2">
          <button className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>Export</button>
          <button className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>Upgrade</button>
          <button className={cn(buttonVariants({ size: "sm" }))}>Request Audit</button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm border" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
