import type { ReactNode } from "react";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";

interface FigureCardProps {
  title: string;
  subtitle?: string;
  figure: ReactNode;
  legend?: ReactNode;
  metadata?: ReactNode;
  note?: ReactNode;
}

export function FigureCard({ title, subtitle, figure, legend, metadata, note }: FigureCardProps) {
  return (
    <WorkspaceCard title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {metadata ? <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs text-text-neutral">{metadata}</div> : null}
        {figure}
        {note ? <p className="border-t pt-3 text-xs leading-relaxed text-text-neutral">{note}</p> : null}
        {legend ? <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-text-neutral">{legend}</div> : null}
      </div>
    </WorkspaceCard>
  );
}
