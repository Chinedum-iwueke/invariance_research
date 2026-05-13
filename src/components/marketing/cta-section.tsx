import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CtaSection() {
  return (
    <Card className="container-shell rounded-lg bg-surface-panel px-card-lg py-card-lg">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="eyebrow">Research Intake</p>
        <h3 className="text-[1.65rem] font-semibold leading-tight md:text-3xl">Submit strategy artifacts for independent quantitative review</h3>
        <p className="text-text-neutral">
          Structured diagnostics, execution-aware risk context, and reproducible reporting workflows.
        </p>
        <div className="mobile-cta-row justify-center">
          <Button>Start Review</Button>
          <Button variant="tertiary">Discuss Scope</Button>
        </div>
      </div>
    </Card>
  );
}
