import { Card } from "@/components/ui/card";

export function AdminStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-text-neutral">{label}</p>
      <p className="text-xl font-semibold text-text-institutional">{value}</p>
    </Card>
  );
}
