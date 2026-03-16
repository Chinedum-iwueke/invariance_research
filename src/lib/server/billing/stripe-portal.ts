import { getStripeClient } from "@/lib/server/billing/stripe-client";

export async function createBillingPortalSession(customerId: string) {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL ?? "http://localhost:3000"}/app/billing`,
  });
}
