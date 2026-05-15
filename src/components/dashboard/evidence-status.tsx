import { AlertTriangle, CheckCircle2, CircleSlash, Clock3, FileWarning, Lock, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type EvidenceState =
  | "supported"
  | "limited"
  | "unsupported"
  | "contradicted"
  | "locked"
  | "processing"
  | "failed"
  | "superseded"
  | "expired"
  | "revoked";

const stateConfig = {
  supported: { label: "Supported", icon: CheckCircle2, className: "border-evidence-supported/25 bg-evidence-supported-wash text-evidence-supported" },
  limited: { label: "Limited", icon: AlertTriangle, className: "border-evidence-limited/30 bg-evidence-limited-wash text-evidence-limited" },
  unsupported: { label: "Unsupported", icon: CircleSlash, className: "border-evidence-unsupported/25 bg-evidence-unsupported-wash text-evidence-unsupported" },
  contradicted: { label: "Contradicted", icon: ShieldAlert, className: "border-evidence-contradicted/25 bg-evidence-contradicted-wash text-evidence-contradicted" },
  locked: { label: "Locked", icon: Lock, className: "border-evidence-locked/25 bg-evidence-locked-wash text-evidence-locked" },
  processing: { label: "Processing", icon: Clock3, className: "border-evidence-processing/25 bg-evidence-processing-wash text-evidence-processing" },
  failed: { label: "Failed", icon: XCircle, className: "border-evidence-contradicted/25 bg-evidence-contradicted-wash text-evidence-contradicted" },
  superseded: { label: "Superseded", icon: RefreshCw, className: "border-evidence-unsupported/25 bg-evidence-unsupported-wash text-evidence-unsupported" },
  expired: { label: "Expired", icon: FileWarning, className: "border-evidence-unsupported/25 bg-evidence-unsupported-wash text-evidence-unsupported" },
  revoked: { label: "Revoked", icon: XCircle, className: "border-evidence-contradicted/25 bg-evidence-contradicted-wash text-evidence-contradicted" },
} as const;

export function normalizeEvidenceState(status?: string): EvidenceState {
  if (status === "available" || status === "enabled" || status === "robust" || status === "advisable") return "supported";
  if (status === "limited" || status === "conditional" || status === "moderate") return "limited";
  if (status === "locked" || status === "plan_locked") return "locked";
  if (status === "processing" || status === "queued" || status === "rendering") return "processing";
  if (status === "failed" || status === "error") return "failed";
  if (status === "superseded") return "superseded";
  if (status === "expired") return "expired";
  if (status === "revoked") return "revoked";
  if (status === "fragile" || status === "contradicted") return "contradicted";
  return "unsupported";
}

export function EvidenceStatusBadge({
  state,
  label,
  reason,
  compact = false,
  className,
}: {
  state: EvidenceState;
  label?: string;
  reason?: string;
  compact?: boolean;
  className?: string;
}) {
  const config = stateConfig[state];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.1em]",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        config.className,
        className,
      )}
      title={reason}
    >
      <Icon className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} strokeWidth={1.8} />
      <span className="truncate">{label ?? config.label}</span>
    </span>
  );
}

export function EvidenceStatePanel({
  state,
  title,
  body,
  reasonCode,
  nextAction,
  className,
}: {
  state: EvidenceState;
  title: string;
  body: string;
  reasonCode?: string;
  nextAction?: string;
  className?: string;
}) {
  const config = stateConfig[state];
  return (
    <div className={cn("rounded-md border bg-surface-paper p-4 shadow-soft", config.className, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <EvidenceStatusBadge state={state} compact />
          <h3 className="mt-3 text-base font-semibold tracking-tight text-text-institutional">{title}</h3>
        </div>
        {reasonCode ? <code className="font-provenance rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[11px] text-text-neutral">{reasonCode}</code> : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-neutral">{body}</p>
      {nextAction ? <p className="mt-3 border-t border-border-subtle pt-3 text-xs font-medium uppercase tracking-[0.1em] text-text-graphite">Next: {nextAction}</p> : null}
    </div>
  );
}
