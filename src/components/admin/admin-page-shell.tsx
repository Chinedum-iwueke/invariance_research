import type { ReactNode } from "react";

export function AdminPageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-institutional">{title}</h1>
        <p className="text-sm text-text-neutral">{description}</p>
      </header>
      {children}
    </section>
  );
}
