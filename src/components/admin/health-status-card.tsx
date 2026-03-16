import { Card } from "@/components/ui/card";

export function HealthStatusCard({ name, status, detail }: { name: string; status: "healthy" | "degraded" | "unhealthy"; detail?: string }) {
  const label = status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Unhealthy";
  const tone = status === "healthy" ? "text-chart-positive" : status === "degraded" ? "text-chart-caution" : "text-chart-negative";

  return (
    <Card className="space-y-1 p-4">
      <p className="text-sm font-medium text-text-institutional">{name}</p>
      <p className={`text-xs ${tone}`}>{label}</p>
      {detail ? <p className="text-xs text-text-neutral">{detail}</p> : null}
    </Card>
  );
}
