import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnalysisPageFrameProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function AnalysisPageFrame({ title, description, children, className }: AnalysisPageFrameProps) {
  return (
    <section className={cn("mx-auto w-full max-w-[72rem] space-y-8", className)}>
      <header className="space-y-3 border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Analysis Workspace</p>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-text-institutional">{title}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-text-neutral">{description}</p>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
