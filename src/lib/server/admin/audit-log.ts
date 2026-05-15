import { randomUUID } from "node:crypto";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";

export interface AdminAuditActor {
  user_id?: string;
  email?: string;
}

export interface AdminAuditEntry {
  id: string;
  actor_user_id?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

function requestIp(request?: Request) {
  return request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request?.headers.get("x-real-ip")
    ?? undefined;
}

export async function writeAdminAuditLog(input: {
  actor?: AdminAuditActor;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const entry: AdminAuditEntry = {
    id: randomUUID(),
    actor_user_id: input.actor?.user_id,
    actor_email: input.actor?.email,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    metadata: input.metadata,
    ip_address: requestIp(input.request),
    user_agent: input.request?.headers.get("user-agent") ?? undefined,
    created_at: new Date().toISOString(),
  };

  if (getDatabaseProvider() === "postgres") {
    await getPostgresPool().query(
      `INSERT INTO admin_audit_log (id, actor_user_id, actor_email, action, resource_type, resource_id, metadata_json, ip_address, user_agent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [entry.id, entry.actor_user_id ?? null, entry.actor_email ?? null, entry.action, entry.resource_type, entry.resource_id ?? null, JSON.stringify(entry.metadata ?? {}), entry.ip_address ?? null, entry.user_agent ?? null, entry.created_at],
    );
  } else {
    getSqliteRuntimeDb()
      .prepare(
        `INSERT INTO admin_audit_log (id, actor_user_id, actor_email, action, resource_type, resource_id, metadata_json, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(entry.id, entry.actor_user_id ?? null, entry.actor_email ?? null, entry.action, entry.resource_type, entry.resource_id ?? null, JSON.stringify(entry.metadata ?? {}), entry.ip_address ?? null, entry.user_agent ?? null, entry.created_at);
  }
  return entry;
}

export async function listAdminAuditLog(limit = 100): Promise<AdminAuditEntry[]> {
  const capped = Math.max(1, Math.min(limit, 250));
  const rows = getDatabaseProvider() === "postgres"
    ? (await getPostgresPool().query<Record<string, unknown>>("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1", [capped])).rows
    : getSqliteRuntimeDb().prepare("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?").all(capped) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    actor_user_id: row.actor_user_id ? String(row.actor_user_id) : undefined,
    actor_email: row.actor_email ? String(row.actor_email) : undefined,
    action: String(row.action),
    resource_type: String(row.resource_type),
    resource_id: row.resource_id ? String(row.resource_id) : undefined,
    metadata: row.metadata_json ? (typeof row.metadata_json === "string" ? JSON.parse(row.metadata_json) : row.metadata_json as Record<string, unknown>) : undefined,
    ip_address: row.ip_address ? String(row.ip_address) : undefined,
    user_agent: row.user_agent ? String(row.user_agent) : undefined,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}
