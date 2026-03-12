import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  chart: ReactNode;
  footer?: string;
  legend?: ReactNode;
}

export function ChartCard({ title, subtitle, toolbar, chart, footer, legend }: ChartCardProps) {
  return (
    <Card className="space-y-4 p-card-md">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm text-text-neutral">{subtitle}</p> : null}
        </div>
        {toolbar}
      </div>
      {chart}
      {legend}
      {footer ? <p className="text-sm leading-relaxed text-text-neutral">{footer}</p> : null}
    </Card>
  );
}
