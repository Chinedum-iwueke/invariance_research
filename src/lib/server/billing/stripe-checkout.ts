import type { PlanId } from "@/lib/contracts/account";
import { BILLING_PLAN_CATALOG } from "@/lib/server/billing/billing-config";
import { getStripeClient } from "@/lib/server/billing/stripe-client";
import { canonicalPlanId } from "@/lib/server/entitlements/plans";

export async function createSubscriptionCheckout(input: { accountId: string; userEmail: string; planId: PlanId }) {
  const planId = canonicalPlanId(input.planId);
  const plan = BILLING_PLAN_CATALOG.find((entry) => entry.id === planId);
  if (!plan || !plan.self_serve_checkout || !plan.stripe_price_id) {
    throw new Error("plan_not_checkout_eligible");
  }
  if (process.env.NODE_ENV === "production" && /^price_(explorer|pro|professional|research_lab)$/.test(plan.stripe_price_id)) {
    throw new Error("stripe_price_not_configured");
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.userEmail,
    client_reference_id: input.accountId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${process.env.APP_URL ?? "http://localhost:3000"}/app/billing?checkout=success`,
    cancel_url: `${process.env.APP_URL ?? "http://localhost:3000"}/app/upgrade?checkout=cancelled`,
    metadata: {
      account_id: input.accountId,
      plan_id: planId,
    },
    subscription_data: {
      metadata: {
        account_id: input.accountId,
        plan_id: planId,
      },
    },
  });

  return session;
}
