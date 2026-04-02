import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PricingCards() {
  const plans = [
    {
      title: "Research Essentials",
      price: "$3,200",
      billing: "per mandate / month",
      features: ["Core strategy diagnostics", "Monthly risk review", "Secure artifact storage"],
    },
    {
      title: "Institutional Suite",
      price: "$7,900",
      billing: "per mandate / month",
      highlight: true,
      features: ["Full robustness framework", "Execution-aware stress testing", "Dedicated analyst support"],
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {plans.map((plan) => (
        <Card key={plan.title} className={cn("space-y-5 p-card-lg", plan.highlight && "border-brand") }>
          <div>
            <p className="text-lg font-semibold">{plan.title}</p>
            <p className="mt-3 text-4xl font-medium">{plan.price}</p>
            <p className="text-sm text-text-neutral">{plan.billing}</p>
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature, featureIndex) => (
              <li key={`${plan.title}-feature-${featureIndex}-${feature.slice(0, 20)}`} className="flex items-center gap-2 text-sm text-text-graphite">
                <Check className="h-4 w-4 text-brand" />
                {feature}
              </li>
            ))}
          </ul>
          <Button variant={plan.highlight ? "primary" : "secondary"} className="w-full">
            {plan.highlight ? "Select Institutional" : "Select Essentials"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
