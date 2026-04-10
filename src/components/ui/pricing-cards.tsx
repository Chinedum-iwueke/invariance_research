import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PricingCards() {
  const plans = [
    {
      title: "Explorer",
      price: "Free",
      billing: "Serious baseline access",
      ctaLabel: "Start Free",
      ctaHref: "/signup",
      features: [
        "Trade CSV upload",
        "3 analyses per month",
        "Overview, Distribution, Monte Carlo, and Risk of Ruin diagnostics",
        "30-day history retention",
      ],
    },
    {
      title: "Professional",
      price: "$11.99",
      billing: "per month",
      ctaLabel: "Choose Professional",
      ctaHref: "/signup",
      features: [
        "Structured bundle upload",
        "25 analyses per month",
        "Execution sensitivity diagnostics",
        "Full report view + report export",
      ],
    },
    {
      title: "Research Lab",
      price: "$19.99",
      billing: "per month",
      highlight: true,
      ctaLabel: "Choose Research Lab",
      ctaHref: "/signup",
      features: [
        "Research bundle upload",
        "100 analyses per month",
        "Regime + stability / fragility diagnostics",
        "Premium processing priority",
      ],
    },
    {
      title: "Advisory",
      price: "Custom",
      billing: "institutional scope",
      ctaLabel: "Request Advisory Scope",
      ctaHref: "/contact",
      features: [
        "Institutional engagement design",
        "Custom throughput and retention",
        "Analyst-led interpretation support",
        "Committee-grade validation workflow",
      ],
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
      {plans.map((plan) => (
        <Card key={plan.title} className={cn("space-y-5 p-card-lg", plan.highlight && "border-brand shadow-[0_0_0_1px_rgba(185,0,42,0.25)]") }>
          <div>
            <p className="text-lg font-semibold">{plan.title}</p>
            <p className="mt-3 text-4xl font-medium">{plan.price}</p>
            <p className="text-sm text-text-neutral">{plan.billing}</p>
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature, featureIndex) => (
              <li key={`${plan.title}-feature-${featureIndex}-${feature.slice(0, 20)}`} className="flex items-start gap-2 text-sm text-text-graphite">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant={plan.highlight ? "primary" : "secondary"} className="w-full">
            <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}
