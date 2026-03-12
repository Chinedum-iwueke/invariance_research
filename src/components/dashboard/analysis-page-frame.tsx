import type { ReactNode } from "react";

interface AnalysisPageFrameProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AnalysisPageFrame({ title, description, children }: AnalysisPageFrameProps) {
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-text-neutral">{description}</p>
      </header>
      {children}
    </section>
  );
}
