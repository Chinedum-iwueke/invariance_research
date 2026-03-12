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
    <Card className="space-y-4 p-card-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        {toolbar}
      </div>
      {children}
      {note ? <p className="text-xs text-text-neutral">{note}</p> : null}
    </Card>
  );
}
