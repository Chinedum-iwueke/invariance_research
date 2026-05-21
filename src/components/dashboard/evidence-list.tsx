import { AlertTriangle, CircleDot, Lightbulb, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EvidenceListTone = "neutral" | "warning" | "positive" | "critical";

const toneStyles: Record<EvidenceListTone, { item: string; icon: string; Icon: LucideIcon }> = {
  neutral: {
    item: "border-border-subtle bg-surface-white text-text-neutral",
    icon: "border-border-subtle bg-surface-subtle text-text-neutral",
    Icon: CircleDot,
  },
  warning: {
    item: "border-amber-500/20 bg-amber-500/8 text-text-neutral",
    icon: "border-amber-500/25 bg-amber-500/10 text-amber-700",
    Icon: AlertTriangle,
  },
  positive: {
    item: "border-chart-positive/20 bg-chart-positive/8 text-text-neutral",
    icon: "border-chart-positive/25 bg-chart-positive/10 text-chart-positive",
    Icon: Lightbulb,
  },
  critical: {
    item: "border-chart-negative/20 bg-chart-negative/8 text-text-neutral",
    icon: "border-chart-negative/25 bg-chart-negative/10 text-chart-negative",
    Icon: ShieldAlert,
  },
};

export function uniqueEvidenceItems(items: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const normalized = items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return typeof limit === "number" ? normalized.slice(0, limit) : normalized;
}

export function EvidenceList({
  items,
  empty,
  tone = "neutral",
  limit,
  className,
}: {
  items: string[];
  empty: string;
  tone?: EvidenceListTone;
  limit?: number;
  className?: string;
}) {
  const renderItems = uniqueEvidenceItems(items, limit);
  const style = toneStyles[tone];
  const Icon = style.Icon;

  if (!renderItems.length) {
    return <p className={cn("text-sm leading-6 text-text-neutral", className)}>{empty}</p>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {renderItems.map((item, index) => (
        <div key={`${index}-${item.slice(0, 36)}`} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 rounded-md border p-2.5", style.item)}>
          <span className={cn("mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border", style.icon)}>
            <Icon className="h-3 w-3" />
          </span>
          <p className="min-w-0 [overflow-wrap:anywhere] text-sm leading-6">{item}</p>
        </div>
      ))}
    </div>
  );
}
