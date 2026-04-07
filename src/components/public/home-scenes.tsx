"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SectionSceneWrapperProps = {
  id: string;
  tone?: "base" | "soft" | "panel";
  className?: string;
  children: ReactNode;
};

export function SectionSceneWrapper({ id, tone = "base", className, children }: SectionSceneWrapperProps) {
  const toneClass = {
    base: "bg-surface-white",
    soft: "bg-[#fcfbfa]",
    panel: "bg-[#f8f7f5]",
  }[tone];

  return (
    <section id={id} className={cn("relative border-t border-black/5", toneClass, className)}>
      <div className="container-shell py-section-md">{children}</div>
    </section>
  );
}

export function HeroOverlayBackground() {
  const overlaySources = [
    "/assets/overlay_graphic.webm",
    "/assets/overlay_graphic.mp4",
    "/assets/overlay_graphic.mov",
  ];

  const fallbackImages = [
    "/assets/overlay_graphic.avif",
    "/assets/overlay_graphic.webp",
    "/assets/overlay_graphic.png",
    "/assets/overlay_graphic.jpg",
    "/assets/overlay_graphic.jpeg",
    "/assets/overlay_graphic.gif",
    "/assets/overlay_graphic.svg",
  ];

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <video className="h-full w-full object-cover opacity-[0.16]" autoPlay muted loop playsInline preload="metadata">
        {overlaySources.map((src) => (
          <source key={src} src={src} />
        ))}
      </video>
      <div className="absolute inset-0 bg-gradient-to-br from-white/94 via-[#fdfcfb]/92 to-white/97" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: fallbackImages.map((src) => `url(${src})`).join(","),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}

export function SceneScrollCue({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="absolute bottom-6 left-1/2 inline-flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-text-neutral transition-colors hover:text-text-graphite"
    >
      <span>Scroll to explore</span>
      <ChevronDown className="h-4 w-4 animate-bounce text-brand" strokeWidth={1.5} />
    </Link>
  );
}

type HeroSceneProps = {
  rightSlot: ReactNode;
};

export function HeroScene({ rightSlot }: HeroSceneProps) {
  return (
    <section id="scene-hero" className="relative isolate flex min-h-[100svh] items-center overflow-hidden border-b border-black/5">
      <HeroOverlayBackground />
      <div className="container-shell grid items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-text-neutral">Independent Quantitative Validation Studio</p>
          <div className="space-y-5">
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-text-graphite md:text-5xl">
              Independent Quantitative Strategy Validation
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-text-neutral">
              Execution-aware analysis, robustness testing, and capital risk diagnostics for serious traders and trading academies.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/research-standards">View Research Standards</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/strategy-validation">Validate Your Strategy</Link>
            </Button>
            <Button asChild variant="tertiary">
              <Link href="/robustness-lab">Explore Strategy Robustness Lab</Link>
            </Button>
          </div>
          <p className="max-w-xl border-l border-brand/40 pl-4 text-sm text-text-neutral">
            Institutional-style validation framework designed to eliminate false edge before capital deployment.
          </p>
        </div>
        <div>{rightSlot}</div>
      </div>
      <SceneScrollCue href="#scene-framework" />
    </section>
  );
}

export function ScrollspyRail({ sectionIds }: { sectionIds: string[] }) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    const observers = sectionIds.map((id) => {
      const element = document.getElementById(id);
      if (!element) {
        return null;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(id);
            }
          });
        },
        { rootMargin: "-35% 0px -45% 0px", threshold: [0.2, 0.4, 0.7] },
      );
      observer.observe(element);
      return observer;
    });

    return () => observers.forEach((observer) => observer?.disconnect());
  }, [sectionIds]);

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
            aria-label={`Jump to ${id.replace("scene-", "")} section`}
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
    <div className="rounded-md border border-black/10 bg-white p-6 shadow-[0_12px_40px_-28px_rgba(17,17,17,0.55)]">
      <div className="inline-flex rounded-full border border-black/10 bg-[#fbfaf8] p-1">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition",
              index === activeIndex ? "bg-[#221f1f] text-white" : "text-text-neutral hover:text-text-graphite",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="rounded-sm border border-black/10 bg-[#fefdfc] p-4">{items[activeIndex]?.visual}</div>
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
  const activeStep = steps[activeIndex];

  return (
    <div className="rounded-md border border-black/10 bg-white p-6 shadow-[0_14px_40px_-32px_rgba(0,0,0,0.55)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        <div className="inline-flex rounded-full border border-black/10 bg-[#f8f6f4] p-1">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                index === activeIndex ? "bg-[#201d1d] text-white" : "text-text-neutral hover:text-text-graphite",
              )}
              aria-label={`View step ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-center">
        <div className="rounded-sm border border-brand/20 bg-brand/[0.04] p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-text-neutral">Current Step</p>
          <p className="mt-2 text-4xl font-semibold text-brand">{String(activeIndex + 1).padStart(2, "0")}</p>
        </div>
        <div className="space-y-2 transition duration-300">
          <h3 className="text-2xl font-semibold text-text-graphite">{activeStep?.title}</h3>
          <p className="text-sm leading-relaxed text-text-neutral">{activeStep?.body}</p>
          {activeStep?.note ? <p className="pt-2 text-xs uppercase tracking-[0.13em] text-text-neutral">{activeStep.note}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CapabilityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border border-black/10 bg-white p-5">
      <h3 className="text-base font-semibold text-text-graphite">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-neutral">{body}</p>
    </div>
  );
}

export function DataVizFeatureCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <article className="rounded-md border border-black/10 bg-white p-5">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-black/10 pb-3">
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
    <div className="grid gap-3 rounded-sm border border-black/10 bg-white p-3 md:grid-cols-4">
      {metrics.map((metric) => {
        const toneClass = metric.tone === "alert" ? "text-brand" : metric.tone === "positive" ? "text-emerald-700" : "text-text-graphite";
        return (
          <div key={metric.label} className="rounded-sm border border-black/10 bg-[#fcfbf9] px-4 py-3">
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
    <div className="relative h-52 overflow-hidden rounded-sm border border-black/10 bg-white p-3">
      <svg className="h-full w-full" viewBox="0 0 420 220" preserveAspectRatio="none">
        <text x="8" y="20" fill="#666" fontSize="10">Equity</text>
        <text x="368" y="208" fill="#666" fontSize="10">Time</text>
        <line x1="30" y1="188" x2="390" y2="188" stroke="#d4d4d4" strokeWidth="1" />
        <line x1="30" y1="24" x2="30" y2="188" stroke="#d4d4d4" strokeWidth="1" />
        <polyline fill="none" stroke="#9ca3af" strokeWidth="1.8" points="30,178 90,168 150,162 210,153 270,142 330,130 390,121" />
        <polyline
          fill="none"
          stroke={executionAware ? "#b00020" : "#b00020"}
          strokeWidth={executionAware ? "2.4" : "2.2"}
          strokeDasharray={executionAware ? "0" : "0"}
          points={executionAware ? "30,180 90,178 150,170 210,173 270,162 330,161 390,156" : "30,182 90,174 150,162 210,146 270,138 330,122 390,98"}
        />
      </svg>
      <div className="absolute right-3 top-3 rounded-sm border border-black/10 bg-white/90 px-3 py-2 text-xs">
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
      <div className="relative h-56 rounded-sm border border-black/10 bg-[#fffdfb] p-3">
        <svg className="h-full w-full" viewBox="0 0 420 220" preserveAspectRatio="none">
          <text x="6" y="16" fill="#666" fontSize="10">Cumulative Return (%)</text>
          <text x="352" y="208" fill="#666" fontSize="10">Quarter</text>
          <line x1="34" y1="188" x2="395" y2="188" stroke="#d4d4d4" strokeWidth="1" />
          <line x1="34" y1="30" x2="34" y2="188" stroke="#d4d4d4" strokeWidth="1" />
          <polyline fill="none" stroke="#4f6b95" strokeWidth="2" points="34,186 94,181 154,170 214,164 274,154 334,145 394,137" />
          <polyline fill="none" stroke="#b00020" strokeWidth="2.5" points="34,186 94,175 154,162 214,145 274,130 334,112 394,95" />
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
