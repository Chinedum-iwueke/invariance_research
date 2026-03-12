import { Activity, Beaker, ShieldCheck, Sigma } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const iconMap = [Beaker, Activity, ShieldCheck, Sigma];

export function FeatureGrid({ columns = 3 }: { columns?: 2 | 3 | 4 }) {
  const features = [
    ["Validation Methodology", "Institutional-grade test batteries across in-sample and out-of-sample periods."],
    ["Execution Diagnostics", "Microstructure-aware checks to evaluate realistic fill quality and slippage."],
    ["Capital Risk Analysis", "Drawdown concentration, leverage stress, and regime dependency mapping."],
    ["Benchmark Comparison", "Transparent cross-strategy comparison against internal and external references."],
  ] as const;

  return (
    <div
      className={cn("grid gap-6", {
        "md:grid-cols-2": columns === 2,
        "md:grid-cols-3": columns === 3,
        "md:grid-cols-4": columns === 4,
      })}
    >
      {features.slice(0, columns === 4 ? 4 : columns === 2 ? 2 : 3).map(([title, description], index) => {
        const Icon = iconMap[index];
        return (
          <Card key={title} className="space-y-4 p-card-md">
            <Icon className="h-5 w-5 text-brand" />
            <h4 className="text-lg font-semibold">{title}</h4>
            <p className="text-sm leading-relaxed text-text-neutral">{description}</p>
          </Card>
        );
      })}
    </div>
  );
}
