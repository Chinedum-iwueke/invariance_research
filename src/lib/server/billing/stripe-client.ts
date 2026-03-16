import Stripe from "stripe";

let singleton: Stripe | undefined;

export function getStripeClient() {
  if (!singleton) {
    singleton = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
  }
  return singleton;
}
