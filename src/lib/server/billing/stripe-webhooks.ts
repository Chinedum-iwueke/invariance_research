import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { PlanId, SubscriptionStatus } from "@/lib/contracts/account";
import { accountService } from "@/lib/server/accounts/service";
import { STRIPE_WEBHOOK_PLAN_BY_PRICE } from "@/lib/server/billing/billing-config";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { webhookEventRepository } from "@/lib/server/repositories/webhook-event-repository";
import { logger } from "@/lib/server/ops/logger";

function toSubscriptionStatus(value: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid"];
  return allowed.includes(value as SubscriptionStatus) ? (value as SubscriptionStatus) : "incomplete";
}

async function applyEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const accountId = session.metadata?.account_id;
    const planId = (session.metadata?.plan_id as PlanId | undefined) ?? "explorer";
    if (!accountId || !session.customer || !session.subscription) return;

    await accountService.applySubscription({
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

    await accountService.applySubscription({
      account_id: accountId,
      provider_customer_id: String(subscription.customer),
      provider_subscription_id: subscription.id,
      plan_id: STRIPE_WEBHOOK_PLAN_BY_PRICE[priceId] ?? "explorer",
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

    await accountService.applySubscription({
      account_id: accountId,
      provider_customer_id: String(subscription.customer),
      provider_subscription_id: subscription.id,
      plan_id: "free",
      status: "canceled",
    });
  }
}

async function findWebhookReceipt(providerEventId: string) {
  if (getDatabaseProvider() !== "postgres") {
    return webhookEventRepository.findByProviderEventId(providerEventId);
  }
  const result = await getPostgresPool().query<Record<string, unknown>>("SELECT * FROM webhook_events WHERE provider_event_id = $1", [providerEventId]);
  const row = result.rows[0];
  return row
    ? {
        webhook_event_id: String(row.webhook_event_id),
        provider: "stripe" as const,
        provider_event_id: String(row.provider_event_id),
        event_type: String(row.event_type),
        received_at: row.received_at instanceof Date ? row.received_at.toISOString() : String(row.received_at),
        processed_at: row.processed_at ? (row.processed_at instanceof Date ? row.processed_at.toISOString() : String(row.processed_at)) : undefined,
        status: row.status as "received" | "processed" | "failed",
        attempt_count: Number(row.attempt_count),
        error_summary: row.error_summary ? String(row.error_summary) : undefined,
        payload_json: typeof row.payload_json === "string" ? row.payload_json : JSON.stringify(row.payload_json),
      }
    : undefined;
}

async function saveWebhookReceived(input: { provider_event_id: string; event_type: string; payload_json: string }) {
  if (getDatabaseProvider() !== "postgres") {
    return webhookEventRepository.saveReceived(input);
  }
  const existing = await findWebhookReceipt(input.provider_event_id);
  if (existing) {
    await getPostgresPool().query("UPDATE webhook_events SET attempt_count = attempt_count + 1, status = $1, error_summary = NULL WHERE provider_event_id = $2", [
      existing.status === "processed" ? "processed" : "received",
      input.provider_event_id,
    ]);
    return (await findWebhookReceipt(input.provider_event_id))!;
  }

  const now = new Date().toISOString();
  const receipt = {
    webhook_event_id: randomUUID(),
    provider: "stripe" as const,
    provider_event_id: input.provider_event_id,
    event_type: input.event_type,
    received_at: now,
    status: "received" as const,
    attempt_count: 1,
    payload_json: input.payload_json,
  };
  await getPostgresPool().query(
    `INSERT INTO webhook_events (webhook_event_id, provider, provider_event_id, event_type, received_at, processed_at, status, attempt_count, error_summary, payload_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [receipt.webhook_event_id, receipt.provider, receipt.provider_event_id, receipt.event_type, receipt.received_at, null, receipt.status, receipt.attempt_count, null, receipt.payload_json],
  );
  return receipt;
}

async function markWebhookProcessed(providerEventId: string) {
  if (getDatabaseProvider() !== "postgres") {
    webhookEventRepository.markProcessed(providerEventId);
    return;
  }
  await getPostgresPool().query("UPDATE webhook_events SET status = 'processed', processed_at = $1, error_summary = NULL WHERE provider_event_id = $2", [
    new Date().toISOString(),
    providerEventId,
  ]);
}

async function markWebhookFailed(providerEventId: string, summary: string) {
  if (getDatabaseProvider() !== "postgres") {
    webhookEventRepository.markFailed(providerEventId, summary);
    return;
  }
  await getPostgresPool().query("UPDATE webhook_events SET status = 'failed', error_summary = $1 WHERE provider_event_id = $2", [summary.slice(0, 500), providerEventId]);
}

export async function applyStripeWebhookEvent(event: Stripe.Event) {
  const receipt = await saveWebhookReceived({
    provider_event_id: event.id,
    event_type: event.type,
    payload_json: JSON.stringify(event),
  });

  if (receipt.status === "processed") {
    logger.info("webhook.stripe.idempotent_noop", { event_id: event.id, event_type: event.type });
    return { idempotent: true };
  }

  try {
    await applyEvent(event);
    await markWebhookProcessed(event.id);
    logger.info("webhook.stripe.processed", { event_id: event.id, event_type: event.type });
    return { idempotent: false };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "webhook_processing_failed";
    await markWebhookFailed(event.id, summary);
    logger.error("webhook.stripe.failed", { event_id: event.id, event_type: event.type, error: summary });
    throw error;
  }
}
