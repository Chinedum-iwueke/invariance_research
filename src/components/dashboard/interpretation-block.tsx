import { Card } from "@/components/ui/card";

interface InterpretationBlockProps {
  title?: string;
  body: string;
  bullets?: string[];
  positives?: string[];
  cautions?: string[];
  caveats?: string[];
}

function StructuredList({ title, items, tone }: { title: string; items?: string[]; tone: "positive" | "warning" | "neutral" }) {
  if (!items?.length) return null;
  const toneClass = tone === "positive" ? "text-chart-positive" : tone === "warning" ? "text-amber-700" : "text-text-graphite";
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{title}</p>
      <ul className="mt-1.5 space-y-1.5 text-sm text-text-neutral">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function InterpretationBlock({ title = "What this means", body, bullets, positives, cautions, caveats }: InterpretationBlockProps) {
  return (
    <Card className="rounded-md border bg-surface-panel/45 p-card-md">
      <h3 className="text-base font-semibold tracking-tight text-text-institutional">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-graphite">{body}</p>
      <div className="mt-3 space-y-3">
        {bullets?.length ? (
          <ul className="space-y-1.5 text-sm text-text-neutral">
            {bullets.map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        ) : null}
        <StructuredList title="Positives" items={positives} tone="positive" />
        <StructuredList title="Cautions" items={cautions} tone="warning" />
        <StructuredList title="Key caveats" items={caveats} tone="neutral" />
      </div>
    </Card>
  );
}
