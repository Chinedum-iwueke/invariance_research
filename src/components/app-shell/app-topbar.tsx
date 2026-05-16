import type { ReactNode } from "react";
import type { AnalysisContext } from "@/lib/app/analysis-ui";

function MetaPill({ children }: { children: ReactNode }) {
  return <span className="rounded-sm border border-border-subtle bg-surface-white px-2.5 py-1 text-xs text-text-graphite shadow-sm">{children}</span>;
}

export function AppTopbar({ context }: { context?: AnalysisContext }) {
  return (
    <div className="border-b border-border-subtle bg-surface-subtle">
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
        ) : null}
      </div>
    </div>
  );
}
