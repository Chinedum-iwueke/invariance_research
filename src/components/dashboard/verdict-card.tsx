import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function VerdictCard({ title, summary, posture }: { title: string; summary: string; posture: "robust" | "moderate" | "fragile" }) {
  return (
    <Card
      className={cn(
        "p-card-md",
        posture === "robust" && "border-chart-positive/30",
        posture === "moderate" && "border-brand/30",
        posture === "fragile" && "border-chart-negative/30",
      )}
    >
      <p className="eyebrow">Validation posture</p>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-neutral">{summary}</p>
    </Card>
  );
}
