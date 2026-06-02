"use client";

import Link from "next/link";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  FileOutput,
  FileText,
  Fingerprint,
  Gauge,
  Inbox,
  Layers3,
  ListChecks,
  Scale,
  SearchCheck,
  Share2,
  ShieldAlert,
  Users,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HeroOverlayBackground } from "@/components/public/hero-overlay-background";
import { EvidenceArtifactPreview } from "@/components/public/evidence-artifact-preview";

type SectionSceneWrapperProps = {
  id: string;
  tone?: "base" | "soft" | "panel";
  transition?: "standard" | "sheet-reveal";
  className?: string;
  children: ReactNode;
};

export function SectionSceneWrapper({ id, tone = "base", transition = "standard", className, children, style }: SectionSceneWrapperProps & { style?: CSSProperties }) {
  const toneClass = {
    base: "bg-surface-white",
    soft: "bg-surface-panel/45",
    panel: "bg-surface-panel/70",
  }[tone];

  return (
    <section id={id} style={style} className={cn("relative isolate min-h-[auto] border-t border-border-subtle md:min-h-screen", toneClass, className)}>
      {transition === "sheet-reveal" ? (
        <div className="relative overflow-hidden rounded-t-[2rem] border-t border-border-subtle/80 bg-surface-white shadow-raised">
          <div className="container-shell pt-8 pb-section-md md:pt-12 md:pb-section-lg">{children}</div>
        </div>
      ) : null}
      {transition === "standard" ? <div className="container-shell py-section-md md:py-section-lg">{children}</div> : null}
    </section>
  );
}

export function SceneScrollCue({ href, className }: { href: string; className?: string }) {
  const targetId = href.startsWith("#") ? href.slice(1) : href;

  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className={cn(
        "inline-flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-text-neutral/90 transition-colors hover:text-text-graphite",
        className,
      )}
      aria-label="Scroll to next section"
    >
      <span>Scroll to explore</span>
      <ChevronDown className="h-4 w-4 text-brand motion-safe:animate-[scroll-cue_2.25s_ease-in-out_infinite]" strokeWidth={1.5} />
    </button>
  );
}

export function HeroScene({ style }: { style?: CSSProperties }) {
  return (
    <section id="hero" style={style} className="relative isolate flex min-h-[calc(100svh-4.75rem)] items-center overflow-hidden bg-surface-white md:min-h-screen">
      <div className="absolute inset-0">
        <HeroOverlayBackground />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--surface-white)_0%,rgba(251,250,247,0.9)_38%,rgba(251,250,247,0.3)_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface-white to-transparent" />
      </div>

      <div className="container-shell relative z-10 grid min-h-[calc(100svh-4.75rem)] items-center gap-8 pt-[max(2.75rem,6svh)] pb-5 md:min-h-screen md:pt-[max(4rem,7svh)]">
        <div className="max-w-[46rem] space-y-5">
          <div className="inline-flex items-center gap-2 border-y border-brand/30 bg-brand/[0.06] px-3 py-2 font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">
            <Fingerprint className="h-3.5 w-3.5" strokeWidth={1.8} />
            Evidence-first strategy validation
          </div>
          <div className="space-y-4">
            <h1 className="font-display max-w-[11.5ch] text-[clamp(3rem,13vw,4.7rem)] font-medium leading-[0.92] text-text-institutional md:text-[clamp(5.2rem,7.2vw,7rem)]">
              Put the strategy claim on trial.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-text-neutral md:text-xl md:leading-8">
              Invariance Research turns trade history, stated claims, and runtime assumptions into a shareable record of what survives realistic pressure.
            </p>
          </div>

          <div className="mobile-cta-row max-w-[22rem] sm:max-w-none">
            <Button asChild className="max-w-full">
              <Link href="/robustness-lab">Enter the Lab</Link>
            </Button>
            <Button asChild variant="secondary" className="max-w-full">
              <Link href="/strategy-validation">Request strategy validation</Link>
            </Button>
          </div>

          <div className="grid max-w-2xl gap-2 border-l border-border-strong pl-4 text-sm text-text-neutral sm:grid-cols-3">
            {["Execution friction", "Capital stress", "Shareable report"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-5 left-1/2 hidden w-[calc(100%-3rem)] max-w-container -translate-x-1/2 items-end justify-between gap-4 md:flex">
          <div />
          <SceneScrollCue href="#claim" />
        </div>
      </div>
    </section>
  );
}

export function EvidenceDocketShowcase() {
  const [activeDocket, setActiveDocket] = useState(0);
  const dockets = [
    {
      label: "Claim",
      title: "Mean reversion edge survives out of sample.",
      status: "Under review",
      score: "62",
      tone: "limited",
      finding: "Execution costs erase 31% of modeled edge.",
    },
    {
      label: "Evidence",
      title: "Strategy remains stable through volatility regime changes.",
      status: "Supported",
      score: "81",
      tone: "supported",
      finding: "Regime stress passes across 4 of 5 slices.",
    },
    {
      label: "Report",
      title: "Deployment should remain capped until slippage proof improves.",
      status: "Conditional",
      score: "74",
      tone: "limited",
      finding: "Shareable artifact ready with explicit limits.",
    },
  ] as const;
  const active = dockets[activeDocket];

  useEffect(() => {
    const timer = window.setInterval(() => setActiveDocket((prev) => (prev + 1) % dockets.length), 6200);
    return () => window.clearInterval(timer);
  }, [dockets.length]);

  return (
    <section className="relative z-20 border-b border-border-subtle bg-surface-white">
      <div className="container-shell grid gap-6 py-section-sm lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
        <div className="max-w-2xl space-y-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Evidence in motion</p>
          <h2 className="text-2xl font-semibold leading-tight text-text-institutional md:text-3xl">From uploaded artifact to defensible verdict.</h2>
          <p className="text-sm leading-7 text-text-neutral md:text-base">
            The Lab tracks what was submitted, which diagnostics are justified, and where the evidence becomes too thin to support a stronger claim.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr] md:items-start">
          <div className="artifact-surface relative z-10 overflow-hidden p-4 shadow-raised">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Live evidence docket</p>
                <p className="mt-1 text-sm text-text-neutral">Strategy Robustness Lab preview</p>
              </div>
              <div className="font-provenance text-right">
                <p className="text-3xl leading-none text-text-institutional">{active.score}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-text-neutral">Readiness</p>
              </div>
            </div>

            <div className="grid gap-3 py-4">
              {dockets.map((docket, index) => {
                const selected = index === activeDocket;
                const toneClass = docket.tone === "supported" ? "border-evidence-supported/35 bg-evidence-supported-wash/70" : "border-evidence-limited/35 bg-evidence-limited-wash/70";
                return (
                  <button
                    key={docket.label}
                    type="button"
                    onClick={() => setActiveDocket(index)}
                    className={cn(
                      "group rounded-sm border p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft",
                      selected ? toneClass : "border-border-subtle bg-surface-panel/45",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{docket.label}</p>
                      <span className={cn("rounded-full border px-2 py-0.5 font-provenance text-[9px] uppercase tracking-[0.1em]", selected ? "border-current text-text-graphite" : "border-border-subtle text-text-neutral")}>
                        {docket.status}
                      </span>
                    </div>
                    <p className="mt-2 text-base font-semibold leading-snug text-text-graphite">{docket.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-text-neutral">{docket.finding}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border-subtle pt-3">
              {[
                ["MC", "available"],
                ["Regime", "locked"],
                ["Report", "ready"],
              ].map(([label, status]) => (
                <div key={label} className="rounded-sm border border-border-subtle bg-surface-panel/55 px-3 py-2">
                  <p className="font-provenance text-[10px] uppercase tracking-[0.1em] text-text-neutral">{label}</p>
                  <p className="mt-1 text-sm font-medium text-text-graphite">{status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="mb-2 flex items-center justify-between border-y border-border-subtle bg-surface-paper/85 px-3 py-2 backdrop-blur-sm">
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-brand">Lab snapshot</p>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">pinned report</p>
            </div>
            <EvidenceArtifactPreview className="w-full shadow-raised" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ValidationDocketRail() {
  const steps = [
    { label: "Claim", body: "State the strategy and the market belief." },
    { label: "Evidence", body: "Test only what the uploaded artifact can support." },
    { label: "Limits", body: "Expose gaps, locked diagnostics, and weak assumptions." },
    { label: "Artifact", body: "Produce a snapshot report safe enough to share." },
  ];

  return (
    <section className="relative z-20 border-y border-border-subtle bg-surface-paper/92 backdrop-blur-md">
      <div className="container-shell grid gap-0 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="group relative border-b border-border-subtle py-4 md:border-b-0 md:border-r md:px-5 last:md:border-r-0">
            <div className="flex items-start gap-3">
              <span className="font-provenance mt-0.5 text-[10px] uppercase tracking-[0.12em] text-brand">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-sm font-semibold text-text-graphite">{step.label}</p>
                <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-text-neutral">{step.body}</p>
              </div>
            </div>
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand transition-all duration-300 group-hover:w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ClaimAuditPanel() {
  const [activeMode, setActiveMode] = useState<"naive" | "execution" | "ledger">("execution");
  const modes = [
    {
      id: "naive",
      label: "Naive curve",
      title: "A clean equity curve is not evidence by itself.",
      body: "A favorable curve can still hide cost drag, regime dependence, and parameter overfit. The first task is to separate performance from proof.",
      visual: <NaiveVsExecutionVisual />,
      icon: BarChart3,
    },
    {
      id: "execution",
      label: "Execution pressure",
      title: "The same claim under realistic frictions becomes a different object.",
      body: "Assumptions stay visible while stress tests change the verdict. The user sees how fees, fills, and uncertainty affect the claim.",
      visual: <NaiveVsExecutionVisual executionAware />,
      icon: Scale,
    },
    {
      id: "ledger",
      label: "Evidence ledger",
      title: "Every diagnostic carries a status, a reason, and a next action.",
      body: "The ledger lets users understand why something is supported, limited, locked, or contradicted before they ever enter the app.",
      visual: <EvidenceLedgerMiniature />,
      icon: ClipboardCheck,
    },
  ] as const;
  const active = modes.find((mode) => mode.id === activeMode) ?? modes[0];
  const Icon = active.icon;

  return (
    <div className="grid overflow-hidden rounded-md border border-border-subtle bg-surface-paper shadow-raised lg:grid-cols-[0.95fr_1.05fr]">
      <div className="border-b border-border-subtle p-4 md:p-6 lg:border-b-0 lg:border-r">
        <div className="grid gap-2">
          {modes.map((mode) => {
            const ModeIcon = mode.icon;
            const selected = mode.id === activeMode;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setActiveMode(mode.id)}
                className={cn(
                  "group flex items-start gap-3 rounded-sm border p-4 text-left transition-all duration-300 hover:-translate-y-0.5",
                  selected ? "border-brand/35 bg-brand/[0.06] shadow-soft" : "border-border-subtle bg-surface-panel/45 hover:bg-surface-panel",
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border", selected ? "border-brand/25 bg-brand text-surface-white" : "border-border-subtle bg-surface-paper text-text-neutral")}>
                  <ModeIcon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{mode.label}</span>
                  <span className="mt-1 block text-sm font-semibold leading-snug text-text-graphite">{mode.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Active examination</p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-text-institutional md:text-3xl">{active.title}</h3>
            <p className="mt-3 text-sm leading-7 text-text-neutral">{active.body}</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-sm border border-brand/25 bg-brand/[0.07] text-brand">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
        </div>
        <div className="transition-all duration-300">{active.visual}</div>
      </div>
    </div>
  );
}

function EvidenceLedgerMiniature() {
  const rows = [
    ["Overview", "supported", "Report-ready"],
    ["Execution", "limited", "Assumptions visible"],
    ["Stability", "locked", "Needs parameters"],
    ["Regimes", "locked", "Needs OHLCV"],
    ["Report", "limited", "Safe with caveats"],
  ];

  return (
    <div className="rounded-sm border border-border-subtle bg-surface-panel/45 p-3">
      <div className="grid gap-2">
        {rows.map(([name, state, reason]) => (
          <div key={name} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm border border-border-subtle bg-surface-paper px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-text-graphite">{name}</p>
              <p className="font-provenance mt-1 text-[10px] uppercase tracking-[0.1em] text-text-neutral">{reason}</p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-1 font-provenance text-[9px] uppercase tracking-[0.1em]",
                state === "supported" && "border-evidence-supported/30 bg-evidence-supported-wash text-evidence-supported",
                state === "limited" && "border-evidence-limited/30 bg-evidence-limited-wash text-evidence-limited",
                state === "locked" && "border-evidence-locked/30 bg-evidence-locked-wash text-evidence-locked",
              )}
            >
              {state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EvidenceOutcomeGrid() {
  const outcomes = [
    {
      title: "Supported",
      body: "Evidence is strong enough to keep investigating or cautiously deploy inside constraints.",
      signal: "green",
      icon: CheckCircle2,
    },
    {
      title: "Limited",
      body: "The claim may still matter, but the artifact does not justify a clean verdict yet.",
      signal: "amber",
      icon: SearchCheck,
    },
    {
      title: "Contradicted",
      body: "The strategy breaks under pressure, with the failure mode stated clearly enough to guide the next decision.",
      signal: "red",
      icon: ShieldAlert,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {outcomes.map((outcome) => {
        const Icon = outcome.icon;
        return (
          <article key={outcome.title} className="group relative overflow-hidden rounded-md border border-border-subtle bg-surface-paper p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-raised">
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                outcome.signal === "green" && "bg-evidence-supported",
                outcome.signal === "amber" && "bg-evidence-limited",
                outcome.signal === "red" && "bg-brand",
              )}
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Verdict state</p>
                <h3 className="mt-2 text-xl font-semibold text-text-graphite">{outcome.title}</h3>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-subtle bg-surface-panel transition-transform duration-300 group-hover:rotate-[-3deg]">
                <Icon className="h-5 w-5 text-brand" strokeWidth={1.8} />
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-text-neutral">{outcome.body}</p>
          </article>
        );
      })}
    </div>
  );
}

export function RobustnessLabIntro() {
  const tiles = [
    ["Upload", "Trades, benchmark, OHLCV, or richer bundles enter with visible eligibility."],
    ["Diagnose", "Only justified diagnostics run. Locked modules explain what evidence is missing."],
    ["Decide", "The Lab turns output into limits, warnings, and next experiments."],
    ["Share", "Reports point at immutable snapshots, not mutable owner dashboards."],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
      <div className="artifact-surface overflow-hidden p-5 md:p-6">
        <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Lab introduction</p>
        <h3 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-text-institutional md:text-4xl">A practical front door for strategy validation.</h3>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-text-neutral">
          The Lab shows the evidence contract before the analysis begins: what the upload supports, what remains limited, and what kind of report can be shared outside the app.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {tiles.map(([title, body]) => (
            <div key={title} className="rounded-sm border border-border-subtle bg-surface-panel/55 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-panel">
              <p className="text-sm font-semibold text-text-graphite">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-text-neutral">{body}</p>
            </div>
          ))}
        </div>
        <div className="mobile-cta-row mt-6">
          <Button asChild>
            <Link href="/robustness-lab">Run Strategy Diagnostics</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/docs/lab">Read Lab Methodology</Link>
          </Button>
        </div>
      </div>
      <div className="relative min-h-[26rem] overflow-hidden rounded-md border border-border-subtle bg-surface-panel/55 p-5 shadow-soft">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(176,0,32,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.5),transparent)]" />
        <div className="relative mx-auto max-w-[25rem]">
          <EvidenceArtifactPreview variant="desk" />
        </div>
      </div>
    </div>
  );
}

export function LabDiagnosticWorkbench() {
  const [active, setActive] = useState<"intake" | "stress" | "report">("stress");
  const panels = {
    intake: {
      label: "Artifact intake",
      title: "Evidence sufficiency is visible before analysis starts.",
      body: "Richer artifacts unlock stronger diagnostics. The intake step explains that clearly before the user commits to an analysis.",
      visual: <EvidenceLedgerMiniature />,
    },
    stress: {
      label: "Stress diagnostics",
      title: "Interactive diagnostic surfaces make pressure feel concrete.",
      body: "Charts and heatmaps act as instruments, showing what changes when execution assumptions and market regimes become less forgiving.",
      visual: <RegimeHeatmapVisual />,
    },
    report: {
      label: "Report artifact",
      title: "The workbench ends in a decision object.",
      body: "The report is positioned as the durable output: generated from a snapshot, safe to share, and explicit about limits.",
      visual: <MetricSnapshotStrip metrics={[{ label: "Readiness", value: "74 / 100" }, { label: "Max DD", value: "-12.8%", tone: "alert" }, { label: "Stress Pass", value: "82%" }, { label: "Snapshot", value: "v1" }]} />,
    },
  } as const;
  const current = panels[active];

  return (
    <div className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-raised md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Diagnostic workbench</p>
          <h3 className="mt-2 text-2xl font-semibold text-text-institutional md:text-3xl">Move through the Lab as a stateful investigation.</h3>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-border-subtle bg-surface-panel/70 p-1">
          {Object.entries(panels).map(([key, panel]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key as keyof typeof panels)}
              className={cn("rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition", active === key ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite")}
            >
              {panel.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 pt-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div className="space-y-3">
          <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-text-neutral">{current.label}</p>
          <h4 className="text-2xl font-semibold leading-tight text-text-graphite">{current.title}</h4>
          <p className="text-sm leading-7 text-text-neutral">{current.body}</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-panel/45 p-3 transition-all duration-300 md:p-4">{current.visual}</div>
      </div>
    </div>
  );
}

export function ShareArtifactSection() {
  const rows = [
    ["Immutable snapshot", "Reports render from pinned evidence, not shifting analysis state."],
    ["Share boundary", "Public views expose allowed findings and hide raw uploads."],
    ["Rescue path", "Expired, revoked, or superseded links fail clearly instead of silently misleading."],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-center">
      <div className="artifact-surface overflow-hidden p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Shared validation report</p>
            <h3 className="mt-3 max-w-2xl font-display text-[clamp(2.4rem,7vw,4.4rem)] font-medium leading-[0.94] text-text-institutional">
              A report someone can forward without explaining the product first.
            </h3>
          </div>
          <Share2 className="h-8 w-8 text-brand" strokeWidth={1.6} />
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-text-neutral">
          Shared reports carry the current evidence state, the limits of the validation, and a clear path for deeper review when automated diagnostics are not enough.
        </p>
        <div className="mt-6 grid gap-3">
          {rows.map(([title, body]) => (
            <div key={title} className="grid gap-3 rounded-sm border border-border-subtle bg-surface-panel/50 p-4 sm:grid-cols-[12rem_1fr]">
              <p className="text-sm font-semibold text-text-graphite">{title}</p>
              <p className="text-sm leading-relaxed text-text-neutral">{body}</p>
            </div>
          ))}
        </div>
        <div className="mobile-cta-row mt-6">
          <Button asChild>
            <Link href="/signup">Create a validation report</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/research-desk">Explore Research Desk</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-md border border-border-subtle bg-surface-paper p-4 shadow-raised">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-brand">Share room state</p>
              <p className="mt-1 text-sm text-text-neutral">Public artifact projection</p>
            </div>
            <Layers3 className="h-5 w-5 text-brand" strokeWidth={1.8} />
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ["Available", "Evidence view opens with snapshot warning state."],
              ["Superseded", "Viewer sees stale artifact notice and rescue path."],
              ["Revoked", "Content closes with no report payload."],
            ].map(([state, body]) => (
              <div key={state} className="rounded-sm border border-border-subtle bg-surface-panel/45 p-3">
                <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{state}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-graphite">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScrollspyRail({ sectionIds, scrollRoot }: { sectionIds: string[]; scrollRoot?: RefObject<HTMLElement | null> }) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visibleEntries.length) return;
        const nextActiveId = visibleEntries[0]?.target.id;
        if (nextActiveId) setActiveId(nextActiveId);
      },
      { root: scrollRoot?.current ?? null, rootMargin: "-25% 0px -45% 0px", threshold: [0.15, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [scrollRoot, sectionIds]);

  return (
    <nav className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 gap-3 md:flex md:flex-col" aria-label="Section progress">
      {sectionIds.map((id) => {
        const isActive = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={cn(
              "h-8 w-[3px] rounded-full bg-black/15 transition-all duration-300",
              isActive && "h-11 bg-brand shadow-[0_0_0_3px_rgba(176,0,32,0.12)]",
            )}
            aria-current={isActive ? "true" : undefined}
            aria-label={`Jump to ${id} section`}
          />
        );
      })}
    </nav>
  );
}

type ComparisonItem = {
  label: string;
  title: string;
  body: string;
  visual: ReactNode;
};

export function ComparisonTogglePanel({ items }: { items: ComparisonItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-white p-4 shadow-soft md:p-6">
      <div className="grid grid-cols-1 gap-1 rounded-sm border border-border-subtle bg-surface-panel/70 p-1 sm:inline-flex sm:rounded-full">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "rounded-sm px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] transition sm:rounded-full sm:px-4 sm:tracking-[0.12em]",
              index === activeIndex ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-5 md:mt-6 md:gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-sm border border-border-subtle bg-surface-panel/50 p-2.5 md:p-4">{items[activeIndex]?.visual}</div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{items[activeIndex]?.label}</p>
          <h3 className="text-xl font-semibold leading-tight text-text-graphite md:text-2xl">{items[activeIndex]?.title}</h3>
          <p className="text-sm leading-relaxed text-text-neutral">{items[activeIndex]?.body}</p>
        </div>
      </div>
    </div>
  );
}

type ProcessStep = { title: string; body: string; note?: string };

export function ProcessStepperCarouselCard({ title, subtitle, steps }: { title: string; subtitle?: string; steps: readonly ProcessStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipState, setFlipState] = useState<"idle" | "out" | "in">("idle");
  const activeStep = steps[activeIndex];
  const activeStepNumber = String(activeIndex + 1).padStart(2, "0");

  const handleDirectStepChange = (index: number) => {
    setFlipState("idle");
    setActiveIndex(index);
  };

  const handleArrowAdvance = () => {
    if (flipState !== "idle" || steps.length < 2) return;
    setFlipState("out");
    window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % steps.length);
      setFlipState("in");
      window.setTimeout(() => setFlipState("idle"), 260);
    }, 180);
  };

  const stepIconByTitle: Record<string, ReactNode> = {
    "Strategy Definition": <FileText className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    "Execution Modeling": <Waypoints className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    "Robustness Testing": <Gauge className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    "Regime Sensitivity Analysis": <ShieldAlert className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    "Capital Risk Diagnostics": <ShieldAlert className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    Scoping: <ListChecks className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    "Data Intake": <Inbox className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    Validation: <Activity className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    Review: <Users className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    Delivery: <FileOutput className="h-7 w-7 text-brand" strokeWidth={1.8} />,
    Reporting: <FileCheck2 className="h-7 w-7 text-brand" strokeWidth={1.8} />,
  };
  const activeStepIcon = stepIconByTitle[activeStep?.title] ?? <FileCheck2 className="h-7 w-7 text-brand" strokeWidth={1.8} />;
  const flipMotionClass =
    flipState === "out"
      ? "opacity-0 [transform:perspective(1200px)_rotateY(-9deg)_translateX(18px)]"
      : flipState === "in"
        ? "opacity-100 [transform:perspective(1200px)_rotateY(0deg)_translateX(0px)]"
        : "opacity-100";

  return (
    <div className="rounded-md border border-border-subtle bg-surface-white p-4 shadow-soft md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-full border border-border-subtle bg-surface-panel/70 p-1">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => handleDirectStepChange(index)}
              className={cn(
                "min-h-9 rounded-full px-2 py-1.5 text-xs font-medium transition md:min-h-0 md:px-3",
                index === activeIndex ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite",
              )}
              aria-label={`View step ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("mt-5 grid gap-4 md:mt-6 md:gap-6 md:grid-cols-[0.7fr_1.3fr]", "transform-gpu transition-all duration-[280ms] ease-out", flipMotionClass)}>
        <div className="flex items-center justify-between rounded-sm border border-brand/30 bg-brand/[0.08] px-4 py-4 md:block md:px-6 md:py-5">
          <p className="text-3xl font-semibold text-brand md:text-4xl">{activeStepNumber}</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-brand/25 bg-surface-white/80 md:mt-5 md:h-11 md:w-11">{activeStepIcon}</div>
        </div>
        <div className="relative space-y-2 rounded-sm border border-border-subtle/70 bg-surface-panel/25 p-4 md:p-5">
          <button
            type="button"
            onClick={handleArrowAdvance}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-surface-white shadow-[0_8px_20px_-14px_rgba(176,0,32,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_rgba(176,0,32,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-brand dark:text-surface-white"
            aria-label={`Advance to next step from step ${activeStepNumber}`}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <h3 className="pr-12 text-xl font-semibold leading-tight text-text-graphite md:text-2xl">{activeStep?.title}</h3>
          <p className="text-sm leading-relaxed text-text-neutral">{activeStep?.body}</p>
          {activeStep?.note ? <p className="pt-2 text-xs uppercase tracking-[0.13em] text-text-neutral">{activeStep.note}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CapabilityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border border-border-subtle bg-surface-white p-5">
      <h3 className="text-base font-semibold text-text-graphite">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-neutral">{body}</p>
    </div>
  );
}

export function DataVizFeatureCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className="rounded-md border border-border-subtle bg-surface-white p-5">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-border-subtle pb-3">
        <div>
          <h3 className="text-lg font-semibold text-text-graphite">{title}</h3>
          <p className="text-xs uppercase tracking-[0.12em] text-text-neutral">{subtitle}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

export function MetricSnapshotStrip({ metrics }: { metrics: Array<{ label: string; value: string; tone?: "base" | "alert" | "positive" }> }) {
  return (
    <div className="grid gap-3 rounded-sm border border-border-subtle bg-surface-white p-3 md:grid-cols-4">
      {metrics.map((metric) => {
        const toneClass = metric.tone === "alert" ? "text-brand" : metric.tone === "positive" ? "text-emerald-700" : "text-text-graphite";
        return (
          <div key={metric.label} className="rounded-sm border border-border-subtle bg-surface-panel/60 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-neutral">{metric.label}</p>
            <p className={cn("mt-2 text-xl font-semibold", toneClass)}>{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}

export function NaiveVsExecutionVisual({ executionAware }: { executionAware?: boolean }) {
  const xTicks = [
    { label: "Jan", x: 72 },
    { label: "Apr", x: 138 },
    { label: "Jul", x: 204 },
    { label: "Oct", x: 270 },
    { label: "Jan", x: 336 },
    { label: "Apr", x: 402 },
    { label: "Jul", x: 468 },
  ];
  const yTicks = [
    { label: "100", y: 216 },
    { label: "110", y: 178 },
    { label: "120", y: 140 },
    { label: "130", y: 102 },
    { label: "140", y: 64 },
    { label: "160", y: 28 },
  ];
  const equityPath = executionAware
    ? "M72 210 L92 205 L108 201 L124 193 L140 185 L156 191 L172 182 L188 175 L204 169 L220 176 L236 172 L252 165 L268 158 L284 163 L300 153 L316 146 L332 151 L348 144 L364 136 L380 141 L396 132 L412 126 L428 129 L448 122 L468 116"
    : "M72 210 L92 207 L108 203 L124 198 L140 192 L156 186 L172 181 L188 175 L204 169 L220 164 L236 158 L252 151 L268 145 L284 138 L300 131 L316 124 L332 116 L348 108 L364 101 L380 93 L396 84 L412 75 L428 66 L448 54 L468 42";
  const baselinePath = executionAware ? "M72 210 L468 156" : "M72 210 L468 96";

  return (
    <div className="relative h-[var(--chart-height-md)] overflow-hidden rounded-sm border border-border-subtle bg-surface-white p-2 md:p-4">
      <svg className="h-full w-full" viewBox="0 0 520 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label={executionAware ? "Execution-aware equity curve diagnostics" : "Naive backtest equity curve diagnostics"}>
        {[72, 138, 204, 270, 336, 402, 468].map((x) => (
          <line key={`v-${x}`} x1={x} y1={28} x2={x} y2={216} stroke="rgba(113,113,122,0.16)" strokeWidth="1" />
        ))}
        {[28, 64, 102, 140, 178, 216].map((y) => (
          <line key={`h-${y}`} x1={72} y1={y} x2={468} y2={y} stroke="rgba(113,113,122,0.16)" strokeWidth="1" />
        ))}

        <line x1={72} y1={216} x2={468} y2={216} stroke="rgba(39,39,42,0.75)" strokeWidth="1.2" />
        <line x1={72} y1={28} x2={72} y2={216} stroke="rgba(39,39,42,0.75)" strokeWidth="1.2" />

        <path d={baselinePath} fill="none" stroke="rgba(107,114,128,0.36)" strokeWidth="1.2" strokeDasharray={executionAware ? "5 5" : undefined} />
        <path d={equityPath} fill="none" stroke="#b00020" strokeWidth={executionAware ? "2.35" : "2.2"} strokeLinejoin="round" strokeLinecap="round" />

        {xTicks.map((tick) => (
          <text key={tick.x} x={tick.x} y={238} textAnchor="middle" className="fill-text-neutral text-[11px]">
            {tick.label}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text key={tick.y} x={58} y={tick.y + 4} textAnchor="end" className="fill-text-neutral text-[11px]">
            {tick.label}
          </text>
        ))}

        <text x={270} y={260} textAnchor="middle" className="fill-text-neutral text-[12px]">
          Time
        </text>
        <text x={16} y={122} transform="rotate(-90 16 122)" textAnchor="middle" className="fill-text-neutral text-[12px]">
          Equity (Normalized)
        </text>
      </svg>

      <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)] rounded-sm border border-border-subtle bg-surface-white/95 px-2.5 py-2 text-[11px] backdrop-blur-sm md:left-4 md:top-4 md:px-3 md:text-xs">
        <div className="inline-flex items-center gap-2">
          <span className="h-[2px] w-6 bg-brand" aria-hidden />
          <span className="text-text-graphite">{executionAware ? "Strategy Equity (Execution-Aware)" : "Strategy Equity (Naïve)"}</span>
        </div>
      </div>
    </div>
  );
}

export function StrategyBenchmarkVisual() {
  const ticks = useMemo(() => ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"], []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-text-neutral">
        <span className="inline-flex items-center gap-2"><span className="h-[2px] w-6 bg-brand" />Strategy</span>
        <span className="inline-flex items-center gap-2"><span className="h-[2px] w-6 bg-[#4f6b95]" />Benchmark</span>
      </div>
      <div className="relative h-[15rem] rounded-sm border border-border-subtle bg-surface-panel/45 p-2 md:h-64 md:p-4">
        <svg className="h-full w-full" viewBox="0 0 460 260" preserveAspectRatio="xMidYMid meet">
          <text x="8" y="20" fill="#666" fontSize="12">Cumulative Return (%)</text>
          <text x="395" y="238" fill="#666" fontSize="12">Quarter</text>
          <line x1="40" y1="214" x2="428" y2="214" stroke="#d4d4d4" strokeWidth="1" />
          <line x1="40" y1="34" x2="40" y2="214" stroke="#d4d4d4" strokeWidth="1" />
          <polyline fill="none" stroke="#4f6b95" strokeWidth="2" points="40,212 106,205 172,192 238,183 304,171 370,159 428,149" />
          <polyline fill="none" stroke="#b00020" strokeWidth="2.5" points="40,212 106,198 172,181 238,159 304,141 370,121 428,101" />
        </svg>
      </div>
      <div className="grid grid-cols-6 gap-2 text-center text-[10px] uppercase tracking-[0.1em] text-text-neutral">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

export function RegimeHeatmapVisual() {
  const rows = ["Low Vol", "Rising Vol", "High Vol", "Liquidity Stress"];
  const cols = ["Trend", "Mean Rev", "Event", "Risk-Off", "Recovery"];

  return (
    <div className="space-y-3">
      <div className="text-xs text-text-neutral">Score legend: pale = weak robustness, deep red = resilient regime performance</div>
      <div className="grid grid-cols-[5.25rem_1fr] gap-2 md:grid-cols-[120px_1fr]">
        <div className="grid gap-1 text-[9px] uppercase tracking-[0.04em] text-text-neutral md:text-[10px] md:tracking-[0.1em]">
          {rows.map((row) => (
            <div key={row} className="flex h-8 items-center justify-end pr-1.5 md:h-9 md:pr-2">{row}</div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: rows.length * cols.length }).map((_, i) => (
            <div key={i} className="h-8 rounded-[2px] md:h-9" style={{ backgroundColor: `rgba(176,0,32,${0.1 + ((i % 5) + Math.floor(i / 5)) * 0.11})` }} />
          ))}
        </div>
      </div>
      <div className="ml-[5.75rem] grid grid-cols-5 gap-1 text-center text-[9px] uppercase tracking-[0.04em] text-text-neutral md:ml-[8rem] md:text-[10px] md:tracking-[0.1em]">
        {cols.map((col) => (
          <span key={col}>{col}</span>
        ))}
      </div>
    </div>
  );
}
