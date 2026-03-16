import { Card } from "@/components/ui/card";
import type { DiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { DiagnosticLockActions } from "@/components/dashboard/diagnostic-lock-actions";
import { DiagnosticLockBadge } from "@/components/dashboard/diagnostic-lock-badge";
import { DiagnosticUnlockRequirements } from "@/components/dashboard/diagnostic-unlock-requirements";

export function DiagnosticLockPanel({ model }: { model: DiagnosticLockModel }) {
  return (
    <Card className="space-y-5 rounded-md border bg-surface-panel p-card-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-institutional">{model.diagnosticTitle}</h3>
        <DiagnosticLockBadge label={model.badgeLabel} />
      </div>

      <p className="text-sm leading-relaxed text-text-neutral">{model.diagnosticPurpose}</p>

      <div className="space-y-2 rounded-sm border bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">Why this is currently unavailable</p>
        <p className="text-sm leading-relaxed text-text-neutral">{model.primaryExplanation}</p>
      </div>

      <DiagnosticUnlockRequirements items={model.unlockRequirements} />

      <DiagnosticLockActions actions={model.actions} />

      <p className="border-t pt-3 text-xs text-text-neutral">{model.footerNote}</p>
    </Card>
  );
}
