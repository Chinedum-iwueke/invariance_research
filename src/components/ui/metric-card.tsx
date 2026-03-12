import { cva, type VariantProps } from "class-variance-authority";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles = cva("", {
  variants: {
    tone: {
      neutral: "text-text-institutional",
      positive: "text-chart-positive",
      negative: "text-chart-negative",
      warning: "text-brand",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

interface MetricCardProps extends VariantProps<typeof toneStyles> {
  label: string;
  value: string;
  helper: string;
  delta?: string;
}

export function MetricCard({ label, value, helper, delta, tone }: MetricCardProps) {
  return (
    <Card className="space-y-3 p-card-md">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{label}</p>
      <p className="text-4xl font-medium tracking-tight">{value}</p>
      <div className="flex items-center justify-between text-sm">
        <p className="text-text-neutral">{helper}</p>
        {delta ? <p className={cn("font-medium", toneStyles({ tone }))}>{delta}</p> : null}
      </div>
    </Card>
  );
}
