"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, type LucideIcon } from "lucide-react";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { cn } from "@/lib/utils";

export type ContextPaneTone = "neutral" | "warning" | "positive";

export interface ContextPane {
  key: string;
  label: string;
  items: string[];
  empty: string;
  tone?: ContextPaneTone;
}

function iconForLabel(label: string): LucideIcon {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("limitation") || normalized.includes("warning")) return AlertTriangle;
  if (normalized.includes("recommendation") || normalized.includes("action")) return Lightbulb;
  return CheckCircle2;
}

function toneClasses(tone: ContextPaneTone): string {
  if (tone === "warning") return "border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300";
  if (tone === "positive") return "border-chart-positive/25 bg-chart-positive/8 text-chart-positive";
  return "border-border-subtle bg-surface-muted text-text-neutral";
}

export function ContextFlipCard({
  title,
  subtitle,
  panes,
}: {
  title: string;
  subtitle: string;
  panes: ContextPane[];
}) {
  const availablePanes = useMemo(() => panes.filter((pane) => pane.items.length > 0), [panes]);
  const renderPanes = availablePanes.length > 0 ? availablePanes : panes;
  const [activeKey, setActiveKey] = useState(renderPanes[0]?.key);
  const active = renderPanes.find((pane) => pane.key === activeKey) ?? renderPanes[0];

  if (!active) {
    return (
      <WorkspaceCard title={title} subtitle={subtitle}>
        <p className="text-sm text-text-neutral">No context was emitted for this run.</p>
      </WorkspaceCard>
    );
  }

  const Icon = iconForLabel(active.label);

  return (
    <WorkspaceCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {renderPanes.map((pane) => {
            const PaneIcon = iconForLabel(pane.label);
            const selected = pane.key === active.key;
            return (
              <button
                key={pane.key}
                type="button"
                onClick={() => setActiveKey(pane.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected ? toneClasses(pane.tone ?? "neutral") : "border-border-subtle bg-surface-panel text-text-neutral hover:border-border hover:text-text-graphite",
                )}
              >
                <PaneIcon className="h-3.5 w-3.5" />
                {pane.label}
              </button>
            );
          })}
        </div>

        <div className={cn("rounded-md border p-4 transition-all", toneClasses(active.tone ?? "neutral"))}>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4" />
            {active.label}
          </p>
          {active.items.length ? (
            <ul className="space-y-1.5 text-sm">
              {active.items.map((item, index) => <li key={`${active.key}-${index}-${item.slice(0, 32)}`}>• {item}</li>)}
            </ul>
          ) : (
            <p className="text-sm">{active.empty}</p>
          )}
        </div>
      </div>
    </WorkspaceCard>
  );
}
