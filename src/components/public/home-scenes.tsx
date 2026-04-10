"use client";

import Link from "next/link";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Activity, ArrowRight, ChevronDown, FileCheck2, FileOutput, FileText, Gauge, Inbox, ListChecks, ShieldAlert, Users, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HeroOverlayBackground } from "@/components/public/hero-overlay-background";

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
    <section id={id} style={style} className={cn("relative isolate min-h-screen snap-start border-t border-border-subtle", toneClass, className)}>
      {transition === "sheet-reveal" ? (
        <div className="relative overflow-hidden rounded-t-[2rem] border-t border-border-subtle/80 bg-surface-white shadow-raised">
          <div className="container-shell pt-10 pb-section-md md:pt-12 md:pb-section-lg">{children}</div>
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
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveScene((prev) => (prev + 1) % 2), 8000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section id="hero" style={style} className="relative isolate flex min-h-screen snap-start items-center overflow-hidden bg-surface-white">
      <div className="absolute inset-0">
        <div className={cn("absolute inset-0 transition-opacity duration-700 ease-out", activeScene === 0 ? "opacity-100" : "opacity-0")}>
          <HeroOverlayBackground />
        </div>
        <div className={cn("absolute inset-0 transition-opacity duration-700 ease-out", activeScene === 1 ? "opacity-100" : "opacity-0")}>
          <HeroOverlayBackground src="/overlay_graphic.png" />
        </div>
      </div>

      <div className="container-shell relative z-10 flex h-[90svh] min-h-[40rem] flex-col pt-[max(3.9rem,7svh)] pb-[max(1.1rem,2.5svh)]">
        <div className="relative flex flex-1 items-center">
          <div className={cn("absolute inset-0 flex items-center transition-all duration-700 ease-out", activeScene === 0 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
            <div className="max-w-[42rem] space-y-4 md:space-y-[1.125rem]">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-neutral/88">Independent Quantitative Validation Studio</p>
              <h1 className="max-w-[14ch] text-4xl font-semibold leading-[1.06] text-text-graphite md:text-5xl lg:text-6xl">
                Independent Quantitative Strategy Validation
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-text-neutral">
                Execution-aware analysis, robustness testing, and capital risk diagnostics for quantitative traders.
              </p>
              <div className="space-y-6 pt-1">
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/robustness-lab">Explore Strategy Robustness Lab</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/strategy-validation">Validate Your Strategy</Link>
                  </Button>
                </div>
                <p className="max-w-xl text-sm text-text-neutral">
                  Institutional-style validation framework designed to eliminate false edge before capital deployment.
                </p>
              </div>
            </div>
          </div>

          <div className={cn("absolute inset-0 flex items-center transition-all duration-700 ease-out", activeScene === 1 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
            <div className="max-w-[36rem] space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">COMING SOON</p>
              <h2 className="max-w-[14ch] text-4xl font-semibold leading-[1.08] text-text-graphite md:text-5xl">Invariance Research Desk</h2>
              <p className="text-xl text-text-graphite">Turn trading ideas into evidence.</p>
              <p className="max-w-xl text-base leading-relaxed text-text-neutral">
                Structured strategy drafting, execution-aware backtesting, diagnostics, and disciplined research iteration.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild>
                  <Link href="/research-desk#waitlist">Join the Waitlist</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/research-desk">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[4.75rem] items-end justify-between pb-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-white/75 p-1 backdrop-blur-sm">
            {[0, 1].map((scene) => (
              <button
                key={scene}
                type="button"
                onClick={() => setActiveScene(scene)}
                className={cn("h-2.5 w-7 rounded-full transition-all duration-300", activeScene === scene ? "bg-brand" : "bg-text-neutral/30 hover:bg-text-neutral/45")}
                aria-label={`Switch to hero scene ${scene + 1}`}
                aria-current={activeScene === scene ? "true" : undefined}
              />
            ))}
          </div>
          <SceneScrollCue href="#problem" />
        </div>
      </div>
    </section>
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
    <div className="rounded-md border border-border-subtle bg-surface-white p-6 shadow-soft">
      <div className="inline-flex rounded-full border border-border-subtle bg-surface-panel/70 p-1">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition",
              index === activeIndex ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-sm border border-border-subtle bg-surface-panel/50 p-4">{items[activeIndex]?.visual}</div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{items[activeIndex]?.label}</p>
          <h3 className="text-2xl font-semibold text-text-graphite">{items[activeIndex]?.title}</h3>
          <p className="text-sm leading-relaxed text-text-neutral">{items[activeIndex]?.body}</p>
        </div>
      </div>
    </div>
  );
}

type ProcessStep = { title: string; body: string; note?: string };

export function ProcessStepperCarouselCard({ title, subtitle, steps }: { title: string; subtitle?: string; steps: ProcessStep[] }) {
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
    <div className="rounded-md border border-border-subtle bg-surface-white p-6 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        <div className="inline-flex rounded-full border border-border-subtle bg-surface-panel/70 p-1">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => handleDirectStepChange(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                index === activeIndex ? "bg-text-institutional text-surface-white" : "text-text-neutral hover:text-text-graphite",
              )}
              aria-label={`View step ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("mt-6 grid gap-6 md:grid-cols-[0.7fr_1.3fr]", "transform-gpu transition-all duration-[280ms] ease-out", flipMotionClass)}>
        <div className="rounded-sm border border-brand/30 bg-brand/[0.08] px-6 py-5">
          <p className="text-4xl font-semibold text-brand">{activeStepNumber}</p>
          <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-sm border border-brand/25 bg-surface-white/80">{activeStepIcon}</div>
        </div>
        <div className="relative space-y-2 rounded-sm border border-border-subtle/70 bg-surface-panel/25 p-5">
          <button
            type="button"
            onClick={handleArrowAdvance}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-surface-white shadow-[0_8px_20px_-14px_rgba(176,0,32,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_rgba(176,0,32,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-brand dark:text-surface-white"
            aria-label={`Advance to next step from step ${activeStepNumber}`}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <h3 className="pr-12 text-2xl font-semibold text-text-graphite">{activeStep?.title}</h3>
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
  return (
    <div className="relative h-64 overflow-hidden rounded-sm border border-border-subtle bg-surface-white p-4">
      <svg className="h-full w-full" viewBox="0 0 460 260" preserveAspectRatio="xMidYMid meet">
        <text x="10" y="24" fill="#666" fontSize="12">Equity</text>
        <text x="402" y="238" fill="#666" fontSize="12">Time</text>
        <line x1="38" y1="214" x2="428" y2="214" stroke="#d4d4d4" strokeWidth="1" />
        <line x1="38" y1="30" x2="38" y2="214" stroke="#d4d4d4" strokeWidth="1" />
        <polyline fill="none" stroke="#9ca3af" strokeWidth="1.8" points="38,202 100,190 162,183 224,171 286,158 348,145 428,132" />
        <polyline
          fill="none"
          stroke={executionAware ? "#b00020" : "#b00020"}
          strokeWidth={executionAware ? "2.4" : "2.2"}
          strokeDasharray={executionAware ? "0" : "0"}
          points={executionAware ? "38,205 100,198 162,188 224,190 286,177 348,174 428,168" : "38,205 100,194 162,177 224,157 286,147 348,128 428,100"}
        />
      </svg>
      <div className="absolute right-3 top-3 rounded-sm border border-border-subtle bg-surface-white/90 px-3 py-2 text-xs">
        <p className="font-medium text-text-graphite">{executionAware ? "Realistic decay visible" : "Smooth edge profile"}</p>
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
      <div className="relative h-64 rounded-sm border border-border-subtle bg-surface-panel/45 p-4">
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
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <div className="grid gap-1 text-[10px] uppercase tracking-[0.1em] text-text-neutral">
          {rows.map((row) => (
            <div key={row} className="flex h-9 items-center justify-end pr-2">{row}</div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: rows.length * cols.length }).map((_, i) => (
            <div key={i} className="h-9 rounded-[2px]" style={{ backgroundColor: `rgba(176,0,32,${0.1 + ((i % 5) + Math.floor(i / 5)) * 0.11})` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[10px] uppercase tracking-[0.1em] text-text-neutral">
        {cols.map((col) => (
          <span key={col}>{col}</span>
        ))}
      </div>
    </div>
  );
}
