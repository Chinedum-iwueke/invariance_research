import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function VerdictCard({
  title,
  summary,
  posture,
  confidence,
  rationale,
}: {
  title: string;
  summary: string;
  posture: "robust" | "moderate" | "fragile";
  confidence?: string;
  rationale?: string[];
}) {
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
      {confidence ? <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-graphite">Confidence: {confidence}</p> : null}
      {rationale?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm text-text-neutral">
          {rationale.slice(0, 4).map((item, index) => (
            <li key={`rationale-${index}-${item.slice(0, 24)}`}>• {item}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
