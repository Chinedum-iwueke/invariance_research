import type Stripe from "stripe";
import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import { accountService } from "@/lib/server/accounts/service";
import { STRIPE_WEBHOOK_PLAN_BY_PRICE } from "@/lib/server/billing/billing-config";
import { webhookEventRepository } from "@/lib/server/repositories/webhook-event-repository";
import { logger } from "@/lib/server/ops/logger";

function toSubscriptionStatus(value: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid"];
  return allowed.includes(value as SubscriptionStatus) ? (value as SubscriptionStatus) : "incomplete";
}

function applyEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const accountId = session.metadata?.account_id;
    const planId = (session.metadata?.plan_id as PlanId | undefined) ?? "professional";
    if (!accountId || !session.customer || !session.subscription) return;

    accountService.applySubscription({
      account_id: accountId,
      provider_customer_id: String(session.customer),
      provider_subscription_id: String(session.subscription),
      plan_id: planId,
      status: "active",
    });
    return;
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const accountId = subscription.metadata?.account_id;
    const priceId = subscription.items.data[0]?.price?.id;
    if (!accountId || !subscription.customer || !priceId) return;

    accountService.applySubscription({
      account_id: accountId,
      provider_customer_id: String(subscription.customer),
      provider_subscription_id: subscription.id,
      plan_id: STRIPE_WEBHOOK_PLAN_BY_PRICE[priceId] ?? "professional",
      status: toSubscriptionStatus(subscription.status),
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const accountId = subscription.metadata?.account_id;
    if (!accountId || !subscription.customer) return;

    accountService.applySubscription({
      account_id: accountId,
      provider_customer_id: String(subscription.customer),
      provider_subscription_id: subscription.id,
      plan_id: "explorer",
      status: "canceled",
    });
  }
}

export function applyStripeWebhookEvent(event: Stripe.Event) {
  const receipt = webhookEventRepository.saveReceived({
    provider_event_id: event.id,
    event_type: event.type,
    payload_json: JSON.stringify(event),
  });

  if (receipt.status === "processed") {
    logger.info("webhook.stripe.idempotent_noop", { event_id: event.id, event_type: event.type });
    return { idempotent: true };
  }

  try {
    applyEvent(event);
    webhookEventRepository.markProcessed(event.id);
    logger.info("webhook.stripe.processed", { event_id: event.id, event_type: event.type });
    return { idempotent: false };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "webhook_processing_failed";
    webhookEventRepository.markFailed(event.id, summary);
    logger.error("webhook.stripe.failed", { event_id: event.id, event_type: event.type, error: summary });
    throw error;
  }
}
