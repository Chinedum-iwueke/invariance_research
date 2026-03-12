import { Card } from "@/components/ui/card";

interface ProcessStep {
  title: string;
  body: string;
}

export function ProcessTimeline({ steps }: { steps: readonly ProcessStep[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-5">
      {steps.map((step, idx) => (
        <li key={step.title}>
          <Card className="h-full p-card-md">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Step {idx + 1}</p>
            <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-neutral">{step.body}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}
