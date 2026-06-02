import type { PlanCatalogEntry } from "@/lib/contracts/billing";
import type { PlanId } from "@/lib/contracts/account";

export const BILLING_PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: "free",
    label: "Free",
    self_serve_checkout: false,
    description: "Limited trade CSV validation with preview diagnostics and short retention.",
  },
  {
    id: "explorer",
    label: "Explorer",
    stripe_price_id: process.env.STRIPE_PRICE_EXPLORER ?? process.env.STRIPE_PRICE_PROFESSIONAL ?? "price_explorer",
    self_serve_checkout: true,
    description: "$39/mo self-serve tier for traders validating trade histories with exports, core diagnostics, and prop evaluation rules when supplied.",
  },
  {
    id: "pro",
    label: "Pro",
    stripe_price_id: process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_RESEARCH_LAB ?? "price_pro",
    self_serve_checkout: true,
    description: "$99/mo tier for high-volume trade-history validation, saved prop evaluation profiles, more share links, optional context ZIPs, and Research Desk request eligibility.",
  },
  {
    id: "research_desk",
    label: "Research Desk",
    self_serve_checkout: false,
    description: "From $1,000 project-based human and agent-assisted validation memo, addenda, execution QA, and claim formalization.",
  },
  {
    id: "professional",
    label: "Professional (legacy Explorer)",
    stripe_price_id: process.env.STRIPE_PRICE_PROFESSIONAL ?? process.env.STRIPE_PRICE_EXPLORER ?? "price_explorer",
    self_serve_checkout: true,
    description: "Legacy alias for Explorer.",
  },
  {
    id: "research_lab",
    label: "Research Lab (legacy Pro)",
    stripe_price_id: process.env.STRIPE_PRICE_RESEARCH_LAB ?? process.env.STRIPE_PRICE_PRO ?? "price_pro",
    self_serve_checkout: true,
    description: "Legacy alias for Pro.",
  },
  {
    id: "advisory",
    label: "Advisory (legacy Research Desk)",
    self_serve_checkout: false,
    description: "Legacy alias for Research Desk.",
  },
];

export const STRIPE_WEBHOOK_PLAN_BY_PRICE: Record<string, PlanId> = {
  [process.env.STRIPE_PRICE_EXPLORER ?? "price_explorer"]: "explorer",
  [process.env.STRIPE_PRICE_PRO ?? "price_pro"]: "pro",
  [process.env.STRIPE_PRICE_TEAM ?? "price_team"]: "team",
  [process.env.STRIPE_PRICE_PROFESSIONAL ?? "price_professional"]: "explorer",
  [process.env.STRIPE_PRICE_RESEARCH_LAB ?? "price_research_lab"]: "pro",
};
