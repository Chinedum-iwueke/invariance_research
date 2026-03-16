import type Stripe from "stripe";
import { applyStripeWebhookEvent } from "@/lib/server/billing/stripe-webhooks";
import { getDb } from "@/lib/server/persistence/database";

export type AdminWebhookReceiptView = {
  webhook_event_id: string;
  provider_event_id: string;
  event_type: string;
  status: "received" | "processed" | "failed";
  attempt_count: number;
  received_at: string;
  processed_at?: string;
  error_summary?: string;
  idempotent_noop: boolean;
  payload_json: string;
};

export function listAdminWebhookReceipts(filter?: "failed" | "unprocessed" | "recent") {
  const rows = getDb()
    .prepare("SELECT * FROM webhook_events ORDER BY received_at DESC")
    .all() as Record<string, unknown>[];

  const receipts: AdminWebhookReceiptView[] = rows.map((row) => ({
    webhook_event_id: String(row.webhook_event_id),
    provider_event_id: String(row.provider_event_id),
    event_type: String(row.event_type),
    status: row.status as AdminWebhookReceiptView["status"],
    attempt_count: Number(row.attempt_count),
    received_at: String(row.received_at),
    processed_at: row.processed_at ? String(row.processed_at) : undefined,
    error_summary: row.error_summary ? String(row.error_summary) : undefined,
    idempotent_noop: row.status === "processed" && Number(row.attempt_count) > 1,
    payload_json: String(row.payload_json),
  }));

  const filtered = receipts.filter((item) => {
    if (filter === "failed") return item.status === "failed";
    if (filter === "unprocessed") return item.status !== "processed";
    if (filter === "recent") return Date.now() - Date.parse(item.received_at) < 86_400_000;
    return true;
  });

  return {
    rows: filtered,
    summary: {
      total: receipts.length,
      failed: receipts.filter((item) => item.status === "failed").length,
      unprocessed: receipts.filter((item) => item.status !== "processed").length,
      idempotent_noop: receipts.filter((item) => item.idempotent_noop).length,
    },
  };
}

export function reprocessAdminWebhook(providerEventId: string) {
  const row = getDb().prepare("SELECT payload_json FROM webhook_events WHERE provider_event_id = ?").get(providerEventId) as
    | { payload_json: string }
    | undefined;
  if (!row) throw new Error("not_found");
  const event = JSON.parse(row.payload_json) as Stripe.Event;
  return applyStripeWebhookEvent(event);
}
