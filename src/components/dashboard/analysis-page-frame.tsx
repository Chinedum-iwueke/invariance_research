import type { ReactNode } from "react";
import { ValidationCommandCenter } from "@/components/dashboard/validation-command-center";
import { cn } from "@/lib/utils";

interface AnalysisPageFrameProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function AnalysisPageFrame({ title, description, children, className }: AnalysisPageFrameProps) {
  return (
    <section className={cn("w-full max-w-none space-y-8", className)}>
      <header className="institutional-panel data-grid-surface relative overflow-hidden px-5 py-5 shadow-soft">
        <div className="absolute inset-y-0 left-0 w-1 bg-research-red shadow-[0_0_28px_var(--brand-red-glow)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-64 bg-[radial-gradient(circle_at_top_right,var(--brand-red-glow),transparent_62%)]" />
        <p className="font-provenance text-[10px] uppercase tracking-[0.14em] text-research-red">Research workspace</p>
        <h1 className="font-display mt-2 text-[clamp(2.1rem,5vw,4.4rem)] font-medium leading-none tracking-normal text-text-institutional">{title}</h1>
        {description ? <p className="mt-3 max-w-5xl text-sm leading-7 text-text-neutral">{description}</p> : null}
        <ValidationCommandCenter />
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
