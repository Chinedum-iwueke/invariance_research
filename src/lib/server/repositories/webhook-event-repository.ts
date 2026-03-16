import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/persistence/database";

export type WebhookEventReceipt = {
  webhook_event_id: string;
  provider: "stripe";
  provider_event_id: string;
  event_type: string;
  received_at: string;
  processed_at?: string;
  status: "received" | "processed" | "failed";
  attempt_count: number;
  error_summary?: string;
  payload_json: string;
};

function mapRow(row: Record<string, unknown>): WebhookEventReceipt {
  return {
    webhook_event_id: String(row.webhook_event_id),
    provider: "stripe",
    provider_event_id: String(row.provider_event_id),
    event_type: String(row.event_type),
    received_at: String(row.received_at),
    processed_at: row.processed_at ? String(row.processed_at) : undefined,
    status: row.status as WebhookEventReceipt["status"],
    attempt_count: Number(row.attempt_count),
    error_summary: row.error_summary ? String(row.error_summary) : undefined,
    payload_json: String(row.payload_json),
  };
}

export const webhookEventRepository = {
  findByProviderEventId(providerEventId: string) {
    const row = getDb().prepare("SELECT * FROM webhook_events WHERE provider_event_id = ?").get(providerEventId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  saveReceived(input: { provider_event_id: string; event_type: string; payload_json: string }) {
    const now = new Date().toISOString();
    const existing = this.findByProviderEventId(input.provider_event_id);
    if (existing) {
      getDb()
        .prepare("UPDATE webhook_events SET attempt_count = attempt_count + 1, status = ?, error_summary = NULL WHERE provider_event_id = ?")
        .run(existing.status === "processed" ? "processed" : "received", input.provider_event_id);
      return this.findByProviderEventId(input.provider_event_id)!;
    }
    const receipt: WebhookEventReceipt = {
      webhook_event_id: randomUUID(),
      provider: "stripe",
      provider_event_id: input.provider_event_id,
      event_type: input.event_type,
      received_at: now,
      status: "received",
      attempt_count: 1,
      payload_json: input.payload_json,
    };
    getDb()
      .prepare(
        `INSERT INTO webhook_events (webhook_event_id, provider, provider_event_id, event_type, received_at, processed_at, status, attempt_count, error_summary, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        receipt.webhook_event_id,
        receipt.provider,
        receipt.provider_event_id,
        receipt.event_type,
        receipt.received_at,
        null,
        receipt.status,
        receipt.attempt_count,
        null,
        receipt.payload_json,
      );
    return receipt;
  },
  markProcessed(providerEventId: string) {
    getDb().prepare("UPDATE webhook_events SET status = 'processed', processed_at = ?, error_summary = NULL WHERE provider_event_id = ?").run(new Date().toISOString(), providerEventId);
  },
  markFailed(providerEventId: string, summary: string) {
    getDb().prepare("UPDATE webhook_events SET status = 'failed', error_summary = ? WHERE provider_event_id = ?").run(summary.slice(0, 500), providerEventId);
  },
};
