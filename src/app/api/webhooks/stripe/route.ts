import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/server/billing/stripe-client";
import { applyStripeWebhookEvent } from "@/lib/server/billing/stripe-webhooks";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing stripe signature/secret" }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    applyStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
