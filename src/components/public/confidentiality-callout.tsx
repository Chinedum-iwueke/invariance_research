import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ConfidentialityCallout() {
  return (
    <Card className="flex items-start gap-3 bg-surface-panel p-card-md">
      <Lock className="mt-0.5 h-4 w-4 text-brand" />
      <div>
        <p className="text-sm font-semibold">Confidentiality and discretion</p>
        <p className="mt-1 text-sm text-text-neutral">
          All strategy artifacts are handled under strict confidentiality conventions. NDA-friendly engagement workflows are supported.
        </p>
      </div>
    </Card>
  );
}
