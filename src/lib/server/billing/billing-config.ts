import type { PlanCatalogEntry } from "@/lib/contracts/billing";
import type { PlanId } from "@/lib/contracts/account";

export const BILLING_PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: "explorer",
    label: "Explorer",
    self_serve_checkout: false,
    description: "Serious free access with limited monthly analysis and report depth.",
  },
  {
    id: "professional",
    label: "Professional",
    stripe_price_id: process.env.STRIPE_PRICE_PROFESSIONAL,
    self_serve_checkout: true,
    description: "Core paid tier with exports, deeper diagnostics, and higher throughput.",
  },
  {
    id: "research_lab",
    label: "Research Lab",
    stripe_price_id: process.env.STRIPE_PRICE_RESEARCH_LAB,
    self_serve_checkout: true,
    description: "Premium research-complete tier for advanced systematic validation work.",
  },
  {
    id: "advisory",
    label: "Advisory / Enterprise",
    self_serve_checkout: false,
    description: "Institutional engagement, custom limits, and expert advisory path.",
  },
];

export const STRIPE_WEBHOOK_PLAN_BY_PRICE: Record<string, PlanId> = {
  [process.env.STRIPE_PRICE_PROFESSIONAL ?? "price_professional"]: "professional",
  [process.env.STRIPE_PRICE_RESEARCH_LAB ?? "price_research_lab"]: "research_lab",
};
