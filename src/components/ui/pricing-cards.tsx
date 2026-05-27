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
        "Trade CSV / exchange export upload",
        "3 analyses per month",
        "Preview overview, prop evaluation, Monte Carlo, distribution, and ruin diagnostics",
        "No exports or share links",
        "30-day history retention",
      ],
    },
    {
      title: "Individual",
      price: "$39",
      billing: "per month",
      ctaLabel: "Choose Individual",
      ctaHref: "/signup",
      features: [
        "Trade CSV, exchange export, and optional context ZIP upload",
        "25 analyses per month",
        "Exact prop rule entry per analysis",
        "Full prop evaluation, execution sensitivity, Monte Carlo, ruin, and distribution workspaces",
        "Polished report export",
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
        "High-volume trade-history validation",
        "100 analyses per month",
        "Saved prop evaluation profiles and richer report appendix",
        "Research Desk request eligibility when evidence cannot support deeper claims",
        "More share links for buyers, coaches, partners, and allocators",
        "25 share links per month",
      ],
    },
    {
      title: "Research Desk",
      price: "From $1,000",
      billing: "project based",
      ctaLabel: "Request Research Desk",
      ctaHref: "/contact",
      features: [
        "Human and agent-assisted validation engagement",
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
