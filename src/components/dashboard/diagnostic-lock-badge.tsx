import { cn } from "@/lib/utils";

export function DiagnosticLockBadge({ label }: { label: "Artifact Limited" | "Engine Limited" | "Plan Locked" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase",
        label === "Plan Locked"
          ? "border-brand/25 bg-brand/10 text-brand"
          : label === "Engine Limited"
            ? "border-amber-300/50 bg-amber-50 text-amber-800"
            : "border-border bg-surface-panel text-text-neutral",
      )}
    >
      {label}
    </span>
  );
}
