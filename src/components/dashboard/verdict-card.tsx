import { EvidenceList } from "@/components/dashboard/evidence-list";
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
        "decision-strip p-card-md",
        posture === "robust" && "border-chart-positive/35 shadow-soft",
        posture === "moderate" && "border-brand/35 verdict-glow",
        posture === "fragile" && "border-chart-negative/35 verdict-glow",
      )}
    >
      <p className="eyebrow">Validation posture</p>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-neutral">{summary}</p>
      {confidence ? <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-graphite">Confidence: {confidence}</p> : null}
      {rationale?.length ? (
        <EvidenceList className="mt-3" items={rationale} empty="No rationale was emitted." tone={posture === "robust" ? "positive" : posture === "fragile" ? "warning" : "neutral"} limit={4} />
      ) : null}
    </Card>
  );
}
