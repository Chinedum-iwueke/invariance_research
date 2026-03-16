import { Card } from "@/components/ui/card";

export function HealthStatusCard({ name, ok, detail }: { name: string; ok: boolean; detail?: string }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-sm font-medium text-text-institutional">{name}</p>
      <p className={ok ? "text-xs text-chart-positive" : "text-xs text-chart-negative"}>{ok ? "Ready" : "Not ready"}</p>
      {detail ? <p className="text-xs text-text-neutral">{detail}</p> : null}
    </Card>
  );
}
