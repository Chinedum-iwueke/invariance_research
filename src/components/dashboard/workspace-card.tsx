import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface WorkspaceCardProps {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  note?: string;
}

export function WorkspaceCard({ title, subtitle, toolbar, children, note }: WorkspaceCardProps) {
  return (
    <Card className="space-y-5 rounded-md border bg-surface-white p-card-md">
      <div className="flex items-start justify-between gap-4 border-b pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-text-institutional">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        {toolbar}
      </div>
      <div>{children}</div>
      {note ? <p className="border-t pt-3 text-xs text-text-neutral">{note}</p> : null}
    </Card>
  );
}
