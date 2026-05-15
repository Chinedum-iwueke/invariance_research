import type Stripe from "stripe";
import { applyStripeWebhookEvent } from "@/lib/server/billing/stripe-webhooks";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";

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

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function readWebhookRows() {
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<Record<string, unknown>>("SELECT * FROM webhook_events ORDER BY received_at DESC");
    return result.rows;
  }
  return getSqliteRuntimeDb().prepare("SELECT * FROM webhook_events ORDER BY received_at DESC").all() as Record<string, unknown>[];
}

export async function listAdminWebhookReceipts(filter?: "failed" | "unprocessed" | "recent") {
  const rows = await readWebhookRows();

  const receipts: AdminWebhookReceiptView[] = rows.map((row) => ({
    webhook_event_id: String(row.webhook_event_id),
    provider_event_id: String(row.provider_event_id),
    event_type: String(row.event_type),
    status: row.status as AdminWebhookReceiptView["status"],
    attempt_count: Number(row.attempt_count),
    received_at: iso(row.received_at),
    processed_at: row.processed_at ? iso(row.processed_at) : undefined,
    error_summary: row.error_summary ? String(row.error_summary) : undefined,
    idempotent_noop: row.status === "processed" && Number(row.attempt_count) > 1,
    payload_json: typeof row.payload_json === "string" ? row.payload_json : JSON.stringify(row.payload_json),
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

export async function reprocessAdminWebhook(providerEventId: string) {
  const row =
    getDatabaseProvider() === "postgres"
      ? (await getPostgresPool().query<{ payload_json: unknown }>("SELECT payload_json FROM webhook_events WHERE provider_event_id = $1", [providerEventId])).rows[0]
      : (getSqliteRuntimeDb().prepare("SELECT payload_json FROM webhook_events WHERE provider_event_id = ?").get(providerEventId) as
          | { payload_json: string }
          | undefined);
  if (!row) throw new Error("not_found");
  const event = (typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json) as Stripe.Event;
  return await applyStripeWebhookEvent(event);
}
