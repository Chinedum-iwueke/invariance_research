import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PricingCards() {
  const plans = [
    {
      title: "Free",
      price: "$0",
      billing: "first evaluator access",
      ctaLabel: "Start Free",
      ctaHref: "/signup",
      features: [
        "1 research program",
        "2 active hypotheses",
        "10 experiment compute units",
        "10 assistant calls",
        "Trade CSV / exchange export import",
        "3 analyses per month",
        "No exports or share links",
        "30-day history retention",
      ],
    },
    {
      title: "Explorer",
      price: "$39",
      billing: "per month",
      ctaLabel: "Choose Explorer",
      ctaHref: "/signup",
      features: [
        "3 research programs",
        "10 active hypotheses",
        "12 queued experiments",
        "80 experiment compute units",
        "100 assistant calls",
        "Trade CSV, exchange export, and optional context ZIP import",
        "25 analyses per month",
        "Program reports, exports, and memory",
        "5 share links per month",
      ],
    },
    {
      title: "Pro",
      price: "$99",
      billing: "per month",
      highlight: true,
      ctaLabel: "Choose Pro",
      ctaHref: "/signup",
      features: [
        "10 research programs",
        "40 active hypotheses",
        "40 queued experiments",
        "250 experiment compute units",
        "500 assistant calls",
        "High-volume trade-history validation imports",
        "100 analyses per month",
        "Expert Review request eligibility when evidence cannot support deeper claims",
        "25 share links per month",
      ],
    },
    {
      title: "Research Desk",
      price: "From $1,000",
      billing: "project based",
      ctaLabel: "Request Expert Review",
      ctaHref: "/contact",
      features: [
        "Human and agent-assisted validation engagement",
        "Scoped research program throughput",
        "Reviewed experiment plan and evidence packet",
        "True parameter stability and multi-asset regime attribution review",
        "Broker-level execution realism and portfolio exposure analysis",
        "Strategy reconstruction and independent validation memo",
      ],
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
      {plans.map((plan) => (
        <Card key={plan.title} className={cn("space-y-5 p-card-lg", plan.highlight && "border-brand shadow-[0_0_0_1px_rgba(185,0,42,0.25)]") }>
          <div>
            <p className="text-lg font-semibold">{plan.title}</p>
            <p className="mt-3 text-3xl font-medium md:text-4xl">{plan.price}</p>
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
