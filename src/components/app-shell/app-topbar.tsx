import type { ReactNode } from "react";
import type { AnalysisContext } from "@/lib/app/analysis-ui";

function MetaPill({ children }: { children: ReactNode }) {
  return <span className="rounded-sm border border-border-subtle bg-surface-panel px-2 py-1 text-xs text-text-graphite">{children}</span>;
}

export function AppTopbar({ context }: { context?: AnalysisContext }) {
  return (
    <div className="border-b bg-surface-white">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 lg:px-10">
        {context ? (
          <>
            <MetaPill>{context.strategy_name}</MetaPill>
            <MetaPill>{context.trade_count} trades</MetaPill>
            <MetaPill>{context.timeframe}</MetaPill>
            <MetaPill>{context.asset}</MetaPill>
            <MetaPill>Status: {context.analysis_status}</MetaPill>
            <span className="rounded-sm border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
              Robustness {context.robustness_score}
            </span>
          </>
        ) : (
          <p className="text-sm text-text-neutral">Authenticated research workspace</p>
        )}
      </div>
    </div>
  );
}
