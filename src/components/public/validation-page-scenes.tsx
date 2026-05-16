"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  Gauge,
  Layers3,
  LockKeyhole,
  Scale,
  Share2,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EvidenceArtifactPreview } from "@/components/public/evidence-artifact-preview";
import { MetricSnapshotStrip, NaiveVsExecutionVisual, RegimeHeatmapVisual } from "@/components/public/home-scenes";

export function LabHeroInstrument() {
  return (
    <div className="grid gap-4">
      <div className="artifact-surface overflow-hidden p-4 shadow-raised">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">IR Labs / Active room</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-text-graphite">Strategy Robustness Lab</h2>
          </div>
          <span className="rounded-full border border-evidence-processing/25 bg-evidence-processing-wash px-2.5 py-1 font-provenance text-[10px] uppercase tracking-[0.1em] text-evidence-processing">
            intake ready
          </span>
        </div>
        <div className="grid gap-3 py-4">
          {[
            ["Artifact sufficiency", "trade CSV accepted", "supported"],
            ["Execution diagnostic", "cost assumptions required", "limited"],
            ["Regime stress", "needs OHLCV context", "locked"],
            ["Report snapshot", "available after run", "processing"],
          ].map(([label, body, state]) => (
            <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm border border-border-subtle bg-surface-panel/50 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-text-graphite">{label}</p>
                <p className="mt-1 font-provenance text-[10px] uppercase tracking-[0.1em] text-text-neutral">{body}</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-1 font-provenance text-[9px] uppercase tracking-[0.1em]",
                  state === "supported" && "border-evidence-supported/30 bg-evidence-supported-wash text-evidence-supported",
                  state === "limited" && "border-evidence-limited/30 bg-evidence-limited-wash text-evidence-limited",
                  state === "locked" && "border-evidence-locked/30 bg-evidence-locked-wash text-evidence-locked",
                  state === "processing" && "border-evidence-processing/30 bg-evidence-processing-wash text-evidence-processing",
                )}
              >
                {state}
              </span>
            </div>
          ))}
        </div>
      </div>
      <EvidenceArtifactPreview variant="lab" />
    </div>
  );
}

export function LabEvidenceConsole() {
  const [active, setActive] = useState<"intake" | "stress" | "artifact">("intake");
  const panels: Record<typeof active, { label: string; title: string; body: string; icon: LucideIcon; visual: ReactNode }> = {
    intake: {
      label: "Intake",
      title: "The upload step teaches the evidence contract.",
      body: "The Lab should make artifact richness visible immediately: what can be tested, what is locked, and what would make the report stronger.",
      icon: ClipboardList,
      visual: <NaiveVsExecutionVisual />,
    },
    stress: {
      label: "Stress",
      title: "Diagnostics behave like instruments, not dashboard decorations.",
      body: "Execution pressure, sequencing risk, and regime changes should feel interactive and inspectable before the user sees a final verdict.",
      icon: Gauge,
      visual: <RegimeHeatmapVisual />,
    },
    artifact: {
      label: "Artifact",
      title: "Every run should point toward a durable report object.",
      body: "The lightweight Lab earns the bigger ambition when users can share the output, receive pushback, and know exactly which evidence state generated it.",
      icon: FileCheck2,
      visual: (
        <MetricSnapshotStrip
          metrics={[
            { label: "Readiness", value: "74 / 100" },
            { label: "Stress Pass", value: "82%" },
            { label: "Max DD", value: "-12.8%", tone: "alert" },
            { label: "Snapshot", value: "v1" },
          ]}
        />
      ),
    },
  };
  const current = panels[active];
  const Icon = current.icon;

  return (
    <div className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-raised md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Lab operating surface</p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight text-text-institutional md:text-3xl">A visible path from upload to evidence artifact.</h3>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-border-subtle bg-surface-panel/70 p-1">
          {(Object.keys(panels) as Array<keyof typeof panels>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={cn("rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition", active === key ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite")}
            >
              {panels[key].label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 pt-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div className="space-y-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-sm border border-brand/25 bg-brand/[0.07] text-brand">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-text-neutral">{current.label}</p>
            <h4 className="mt-2 text-2xl font-semibold leading-tight text-text-graphite">{current.title}</h4>
            <p className="mt-3 text-sm leading-7 text-text-neutral">{current.body}</p>
          </div>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-panel/45 p-3 md:p-4">{current.visual}</div>
      </div>
    </div>
  );
}

export function MethodologyHeroInstrument() {
  return (
    <div className="artifact-surface p-4 shadow-raised">
      <div className="border-b border-border-subtle pb-3">
        <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Validation rulebook</p>
        <h2 className="mt-1 text-xl font-semibold text-text-graphite">Claim handling protocol</h2>
      </div>
      <div className="mt-4 grid gap-2">
        {[
          ["01", "Define the claim"],
          ["02", "Map evidence sufficiency"],
          ["03", "Apply execution pressure"],
          ["04", "Expose failure states"],
          ["05", "Write the decision artifact"],
        ].map(([step, title]) => (
          <div key={step} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-sm border border-border-subtle bg-surface-panel/50 px-3 py-2">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">{step}</p>
            <p className="text-sm font-semibold text-text-graphite">{title}</p>
            <BadgeCheck className="h-4 w-4 text-text-neutral" strokeWidth={1.8} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MethodologyRulebook() {
  const [active, setActive] = useState(0);
  const rules = [
    {
      title: "Evidence before verdict",
      body: "The interface must explain what the artifact can support before it sells any conclusion.",
      icon: BookOpenCheck,
    },
    {
      title: "Execution changes the truth",
      body: "Cost, latency, spread, and sizing assumptions are treated as first-class inputs, not footnotes.",
      icon: Scale,
    },
    {
      title: "Locked states are useful",
      body: "A diagnostic that cannot run still teaches the user what evidence is missing and why it matters.",
      icon: LockKeyhole,
    },
    {
      title: "Reports are snapshots",
      body: "Every shareable output should point to the specific evidence state that produced it.",
      icon: Share2,
    },
  ];
  const current = rules[active];
  const Icon = current.icon;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-2">
        {rules.map((rule, index) => {
          const RuleIcon = rule.icon;
          return (
            <button
              key={rule.title}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "group flex items-start gap-3 rounded-sm border p-4 text-left transition-all duration-300 hover:-translate-y-0.5",
                active === index ? "border-brand/35 bg-brand/[0.06] shadow-soft" : "border-border-subtle bg-surface-paper hover:bg-surface-panel/60",
              )}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border", active === index ? "border-brand/25 bg-brand text-surface-white" : "border-border-subtle bg-surface-panel text-text-neutral")}>
                <RuleIcon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="text-sm font-semibold text-text-graphite">{rule.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-text-neutral">{rule.body}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="artifact-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Active principle</p>
            <h3 className="mt-2 text-3xl font-semibold leading-tight text-text-institutional">{current.title}</h3>
          </div>
          <Icon className="h-8 w-8 text-brand" strokeWidth={1.7} />
        </div>
        <p className="mt-4 text-sm leading-7 text-text-neutral">{current.body}</p>
        <div className="mt-6 rounded-sm border border-border-subtle bg-surface-panel/55 p-4">
          <NaiveVsExecutionVisual executionAware />
        </div>
      </div>
    </div>
  );
}

export function StrategyValidationHeroInstrument() {
  return (
    <div className="grid gap-4">
      <EvidenceArtifactPreview variant="report" />
      <div className="artifact-surface grid grid-cols-3 gap-2 p-3">
        {[
          ["Scope", "locked"],
          ["Evidence", "mapped"],
          ["Report", "committee-ready"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-border-subtle bg-surface-panel/55 px-3 py-2">
            <p className="font-provenance text-[10px] uppercase tracking-[0.1em] text-text-neutral">{label}</p>
            <p className="mt-1 text-sm font-medium text-text-graphite">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StrategyValidationScopeBoard() {
  const [active, setActive] = useState(1);
  const tiers = [
    {
      tier: "Audit Foundation",
      summary: "Single-strategy diagnostic baseline",
      window: "2-3 weeks",
      emphasis: "Best when the team needs a sober second opinion before deeper spend.",
      icon: FlaskConical,
    },
    {
      tier: "Institutional Audit",
      summary: "Multi-layer robustness and capital-risk review",
      window: "3-5 weeks",
      emphasis: "Best when a strategy is nearing allocation, investor review, or committee scrutiny.",
      icon: Layers3,
    },
    {
      tier: "Bespoke Engagement",
      summary: "Custom mandate for complex portfolios",
      window: "Variable",
      emphasis: "Best when data, constraints, or portfolio structure require a custom evidence map.",
      icon: SlidersHorizontal,
    },
  ];

  return (
    <div className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-raised md:p-6">
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier, index) => {
          const Icon = tier.icon;
          const selected = active === index;
          return (
            <button
              key={tier.tier}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "group rounded-sm border p-4 text-left transition-all duration-300 hover:-translate-y-1",
                selected ? "border-brand/35 bg-brand/[0.06] shadow-soft" : "border-border-subtle bg-surface-panel/45 hover:bg-surface-panel",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-5 w-5 text-brand" strokeWidth={1.8} />
                <span className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{tier.window}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text-graphite">{tier.tier}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-neutral">{tier.summary}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-5 rounded-sm border border-border-subtle bg-surface-panel/50 p-4">
        <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Selected mandate</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h4 className="text-2xl font-semibold text-text-institutional">{tiers[active].tier}</h4>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-text-neutral">{tiers[active].emphasis}</p>
          </div>
          <Link href="#request" className="inline-flex items-center gap-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Request this scope
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DeliverableLedger({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <div key={item} className="group grid grid-cols-[2.75rem_1fr] gap-3 rounded-sm border border-border-subtle bg-surface-paper p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft">
          <span className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="text-sm font-semibold text-text-graphite">{item}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-neutral">Included in the evidence ledger and final decision artifact.</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageTransitionBand({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="artifact-surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
      <div>
        <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Next room</p>
        <h3 className="mt-2 text-2xl font-semibold leading-tight text-text-institutional">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-text-neutral">{body}</p>
      </div>
      <Button asChild>
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}

export function AmbitionBridge() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Lab-first", "Fastest path to user evidence through a working diagnostic room."],
        ["Report-first", "The report becomes the artifact users share, contest, and request work around."],
        ["Full ambition", "Research Desk and evidence memory emerge from repeated report demand."],
      ].map(([title, body], index) => (
        <article key={title} className="relative overflow-hidden rounded-md border border-border-subtle bg-surface-paper p-5 shadow-soft">
          <Sparkles className="absolute right-4 top-4 h-5 w-5 text-brand/70" strokeWidth={1.6} />
          <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">{String(index + 1).padStart(2, "0")}</p>
          <h3 className="mt-4 text-lg font-semibold text-text-graphite">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-text-neutral">{body}</p>
        </article>
      ))}
    </div>
  );
}
