import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ReportPreviewCard() {
  return (
    <Card className="space-y-4 p-card-md">
      <div className="aspect-[16/9] rounded-sm border bg-surface-panel" />
      <div>
        <p className="text-lg font-semibold">Q4 Multi-Factor Robustness Review</p>
        <p className="mt-1 text-sm text-text-neutral">Updated 03 Jan 2026 · 28 pages · Institutional distribution</p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-sm border bg-surface-panel p-2">
          <p className="text-xs text-text-neutral">Sharpe</p>
          <p className="font-medium">1.38</p>
        </div>
        <div className="rounded-sm border bg-surface-panel p-2">
          <p className="text-xs text-text-neutral">Max DD</p>
          <p className="font-medium">-8.1%</p>
        </div>
        <div className="rounded-sm border bg-surface-panel p-2">
          <p className="text-xs text-text-neutral">Drift</p>
          <p className="font-medium">Low</p>
        </div>
      </div>
      <Button variant="tertiary" className="w-full border border-border-subtle">
        Open Report Preview
      </Button>
    </Card>
  );
}
