import { Card } from "@/components/ui/card";

interface InterpretationBlockProps {
  title?: string;
  body: string;
  bullets?: string[];
}

export function InterpretationBlock({ title = "What this means", body, bullets }: InterpretationBlockProps) {
  return (
    <Card className="rounded-md border bg-surface-panel/45 p-card-md">
      <h3 className="text-base font-semibold tracking-tight text-text-institutional">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-graphite">{body}</p>
      {bullets?.length ? (
        <ul className="mt-3 space-y-1.5 text-sm text-text-neutral">
          {bullets.map((bullet) => (
            <li key={bullet}>• {bullet}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
