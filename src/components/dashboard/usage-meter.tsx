import { Card } from "@/components/ui/card";

export function UsageMeter({ used, limit, retentionDays, unlimited = false }: { used: number; limit: number; retentionDays: number; unlimited?: boolean }) {
  const ratio = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const remaining = unlimited ? null : Math.max(0, limit - used);

  return (
    <Card className="space-y-3 rounded-md border bg-surface-white p-card-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-institutional">Monthly analysis usage</h3>
        <p className="text-xs text-text-neutral">{unlimited ? `${used} / Unlimited` : `${used} / ${limit}`}</p>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-panel">
        <div className="h-2 rounded-full bg-brand" style={{ width: unlimited ? "22%" : `${ratio}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-text-neutral">
        <p>{unlimited ? "Unlimited analyses available" : `${remaining} analyses remaining`}</p>
        <p>History retention: {retentionDays} days</p>
      </div>
    </Card>
  );
}
