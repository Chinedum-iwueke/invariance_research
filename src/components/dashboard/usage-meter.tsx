import { Card } from "@/components/ui/card";

export function UsageMeter({ used, limit, retentionDays }: { used: number; limit: number; retentionDays: number }) {
  const ratio = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const remaining = Math.max(0, limit - used);

  return (
    <Card className="space-y-3 rounded-md border bg-surface-white p-card-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-institutional">Monthly analysis usage</h3>
        <p className="text-xs text-text-neutral">{used} / {limit}</p>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-panel">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${ratio}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-text-neutral">
        <p>{remaining} analyses remaining</p>
        <p>History retention: {retentionDays} days</p>
      </div>
    </Card>
  );
}
