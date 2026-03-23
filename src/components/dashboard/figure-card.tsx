import type { ReactNode } from "react";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

interface FigureCardProps {
  title: string;
  subtitle?: string;
  figure: ReactNode;
  legend?: ReactNode;
  note?: string;
  metadata?: ReactNode;
}

export function FigureCard({ title, subtitle, figure, legend, note, metadata }: FigureCardProps) {
  return (
    <WorkspaceCard title={title} subtitle={subtitle} note={note}>
      <div className="space-y-3">
        {metadata ? <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs text-text-neutral">{metadata}</div> : null}
        {figure}
        {legend ? <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-text-neutral">{legend}</div> : null}
      </div>
    </WorkspaceCard>
  );
}
