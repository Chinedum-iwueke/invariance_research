import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const toneIcon = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
} as const;

export function InsightPanel() {
  const insights = [
    { tone: "info", text: "Regime-adjusted variance remains within expected envelope." },
    { tone: "warning", text: "Post-cost alpha concentration increased in the latest quarter." },
    { tone: "success", text: "Stress outcomes remain above benchmark resilience thresholds." },
  ] as const;

  return (
    <Card className="space-y-4 p-card-md">
      <h3 className="text-lg font-semibold">Analyst Insights</h3>
      <ul className="space-y-3">
        {insights.map((insight, index) => {
          const Icon = toneIcon[insight.tone];
          return (
            <li key={index} className="flex items-start gap-3 rounded-sm border bg-surface-panel/50 p-3">
              <Icon className="mt-0.5 h-4 w-4 text-brand" />
              <span className="text-sm text-text-graphite">{insight.text}</span>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" className="w-full">
        Review Full Commentary
      </Button>
    </Card>
  );
}
