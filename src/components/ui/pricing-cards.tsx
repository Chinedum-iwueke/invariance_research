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
        "Trade CSV upload",
        "3 analyses per month",
        "Evidence-limited previews for core upload diagnostics",
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
        "Structured bundle upload",
        "25 analyses per month",
        "Evidence-gated execution sensitivity and one custom prop evaluation profile per analysis",
        "Full report view + report export",
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
        "Research bundle upload",
        "100 analyses per month",
        "More share links and deeper report workflow",
        "Research Desk request eligibility for regime, stability, broker, reconstruction, and exposure gaps",
        "Saved prop evaluation profiles and report appendix",
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
        "Institutional engagement design",
        "Human and agent-assisted review",
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
