import type { ReactNode } from "react";

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border-subtle bg-surface-panel p-3">{children}</div>;
}
