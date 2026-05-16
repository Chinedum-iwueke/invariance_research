"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type FlowStage = {
  label: string;
  explanation: string;
};

const stages: FlowStage[] = [
  { label: "Idea", explanation: "Capture raw market intuition in natural language without losing the originating context." },
  { label: "Clarification", explanation: "AI assistants identify missing assumptions, ambiguous terms, and unstated constraints before testing." },
  { label: "Formal Hypothesis", explanation: "Convert intent into explicit strategy logic, parameter defaults, and validation criteria." },
  { label: "Backtest", explanation: "Run execution-aware simulation with fee, spread, slippage, and venue assumptions made explicit." },
  { label: "Diagnostics", explanation: "Decompose outcomes to isolate fragility, regime dependence, drawdown character, and fee drag." },
  { label: "Iteration", explanation: "Research agents propose next experiments based on evidence, not narrative momentum." },
  { label: "Deployment Readiness", explanation: "Assess whether evidence quality and implementation realism justify live capital exposure." },
];

export function ResearchDeskFlow() {
  const [activeIndex, setActiveIndex] = useState(0);

  const traceWidth = useMemo(() => {
    if (stages.length <= 1) return "0%";
    return `${(activeIndex / (stages.length - 1)) * 100}%`;
  }, [activeIndex]);

  return (
    <section className="container-shell py-section-sm">
      <div className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-raised md:p-7">
        <div className="mb-7 max-w-3xl space-y-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Research lineage</p>
          <h2 className="text-2xl font-semibold leading-tight text-text-institutional md:text-4xl">From intuition to a remembered evidence trail.</h2>
          <p className="text-sm leading-relaxed text-text-neutral md:text-base">Research Desk is designed to turn vague market intuition into a disciplined, AI-assisted research process whose failures and decisions are not forgotten.</p>
        </div>

        <div className="space-y-6">
          <div className="relative overflow-x-auto pb-2">
            <div className="relative min-w-[42rem] md:min-w-0">
              <div className="absolute left-0 right-0 top-4 h-px bg-border-subtle" />
              <div className="absolute left-0 top-4 h-px bg-gradient-to-r from-brand via-brand/60 to-brand/10 transition-all duration-500" style={{ width: traceWidth }} />
              <div className="grid grid-cols-7 gap-3">
                {stages.map((stage, index) => {
                  const isActive = index === activeIndex;
                  const isPassed = index <= activeIndex;
                  return (
                    <button
                      key={stage.label}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      onClick={() => setActiveIndex(index)}
                      className="group relative pt-0.5 text-left"
                      aria-current={isActive ? "true" : undefined}
                    >
                      <span
                        className={cn(
                          "mb-3 block h-3 w-3 rounded-full border transition-all duration-300",
                          isActive
                            ? "scale-110 border-brand bg-brand shadow-[0_0_0_4px_rgba(176,0,32,0.12)]"
                            : isPassed
                              ? "border-brand/70 bg-brand/65"
                              : "border-border-subtle bg-surface-white",
                        )}
                      />
                      <span className={cn("font-provenance text-[10px] uppercase tracking-[0.1em] transition-colors", isActive ? "text-text-graphite" : "text-text-neutral group-hover:text-text-graphite")}>{stage.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-sm border border-border-subtle bg-surface-panel/45 p-4 md:grid-cols-[1fr_16rem] md:p-5">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">{stages[activeIndex]?.label}</p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-neutral">{stages[activeIndex]?.explanation}</p>
            </div>
            <div className="rounded-sm border border-border-subtle bg-surface-paper p-3">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Memory write</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-text-graphite">This stage becomes context for the next experiment.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
