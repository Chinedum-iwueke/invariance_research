import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface WorkspaceCardProps {
  title?: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  note?: string;
}

export function WorkspaceCard({ title, subtitle, toolbar, children, note }: WorkspaceCardProps) {
  const showHeader = Boolean(title || subtitle || toolbar);

  return (
    <Card className="artifact-surface space-y-5 overflow-hidden rounded-md border-border-subtle bg-surface-white p-0 shadow-sm">
      {showHeader ? (
        <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            {title ? (
              <h2 className="font-display text-[clamp(1.35rem,2.2vw,2rem)] font-medium leading-none tracking-normal text-text-institutional">
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">{subtitle}</p> : null}
          </div>
          {toolbar}
        </div>
      ) : null}
      <div className="px-5 py-5">{children}</div>
      {note ? <p className="border-t border-border-subtle bg-surface-subtle px-5 py-3 text-xs leading-5 text-text-neutral">{note}</p> : null}
    </Card>
  );
}
