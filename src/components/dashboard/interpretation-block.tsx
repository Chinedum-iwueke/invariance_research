import { Card } from "@/components/ui/card";

export function InterpretationBlock({ title = "What this means", body }: { title?: string; body: string }) {
  return (
    <Card className="p-card-md">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-neutral">{body}</p>
    </Card>
  );
}
