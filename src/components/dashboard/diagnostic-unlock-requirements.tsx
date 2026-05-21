import { EvidenceList } from "@/components/dashboard/evidence-list";

export function DiagnosticUnlockRequirements({ items }: { items: string[] }) {
  return (
    <div className="space-y-2 rounded-sm border bg-surface-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-neutral">What would unlock this</p>
      <EvidenceList items={items} empty="No unlock requirements were emitted." tone="positive" />
    </div>
  );
}
