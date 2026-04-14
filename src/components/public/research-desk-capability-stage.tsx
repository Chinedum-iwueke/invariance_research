"use client";

import { useState } from "react";
import { Bot, BrainCircuit, GitBranchPlus, LineChart, Route } from "lucide-react";
import { cn } from "@/lib/utils";

type Capability = {
  title: string;
  body: string;
  detail: string;
  Icon: typeof Bot;
};

const capabilities: Capability[] = [
  {
    title: "AI Strategy Assistant",
    body: "Turn plain-English ideas into structured, testable strategy definitions with explicit assumptions, defaults, and missing fields surfaced clearly.",
    detail: "Prompt-to-spec drafting with explicit assumption tracking and structured completion checks.",
    Icon: Bot,
  },
  {
    title: "AI Research Agents",
    body: "Use purpose-built AI agents to clarify intent, formalize hypotheses, validate assumptions, interpret results, and propose the next best experiment.",
    detail: "Routed multi-agent orchestration for disciplined hypothesis refinement.",
    Icon: Route,
  },
  {
    title: "Execution-Realistic Backtesting",
    body: "Move beyond optimistic simulations with workflows designed around fees, spread, slippage, venue context, and realistic implementation assumptions.",
    detail: "Execution-path modeling designed for implementation realism rather than idealized fills.",
    Icon: LineChart,
  },
  {
    title: "Diagnostic Intelligence",
    body: "Go beyond headline performance to understand what drove the result — regime dependence, fee drag, fragility, drawdown structure, and survivability.",
    detail: "Decomposition-first diagnostics that isolate drivers of edge stability.",
    Icon: BrainCircuit,
  },
  {
    title: "Research Memory and Iteration",
    body: "Build cumulative research over time instead of isolated runs, with a system designed to remember what was tested, what failed, and what should be explored next.",
    detail: "Lineage-aware memory graph for continuity across experiments and decisions.",
    Icon: GitBranchPlus,
  },
];

export function ResearchDeskCapabilityStage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCapability = capabilities[activeIndex];

  return (
    <section className="container-shell py-section-sm">
      <div className="rounded-lg border border-border-subtle bg-surface-panel/35 p-5 md:p-7">
        <div className="mb-6 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-neutral">Signature capabilities</p>
          <h2 className="text-2xl font-semibold text-text-institutional md:text-3xl">Guided system reveal</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-[17rem_1fr]">
          <div className="space-y-2">
            {capabilities.map((capability, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={capability.title}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "w-full rounded-sm border px-3 py-3 text-left transition-all duration-300",
                    isActive
                      ? "border-brand/55 bg-surface-white shadow-soft"
                      : "border-border-subtle bg-surface-white/55 hover:border-brand/35 hover:bg-surface-white",
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Layer {String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-1 text-sm font-medium text-text-graphite">{capability.title}</p>
                </button>
              );
            })}
          </div>

          <article className="relative overflow-hidden rounded-sm border border-border-subtle bg-surface-white p-5 md:p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/65 to-transparent" />
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-sm border border-brand/35 bg-brand/10 p-2 text-brand">
                <activeCapability.Icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-neutral">{activeCapability.detail}</p>
            </div>
            <h3 className="max-w-[28ch] text-2xl font-semibold text-text-institutional">{activeCapability.title}</h3>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-neutral">{activeCapability.body}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
