import { NextResponse } from "next/server";
import { logger } from "@/lib/server/ops/logger";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";
import { getSqliteRuntimeDb } from "@/lib/server/persistence/sqlite-runtime";

export type RateLimitKind = "auth" | "upload" | "analysis_create" | "export" | "share_create" | "share_access" | "research_desk" | "waitlist";

const DEFAULT_MAX: Record<RateLimitKind, number> = {
  auth: 10,
  upload: 20,
  analysis_create: 10,
  export: 20,
  share_create: 20,
  share_access: 120,
  research_desk: 5,
  waitlist: 5,
};

function enabled() {
  return (process.env.RATE_LIMITS_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

function windowMs() {
  const parsed = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function maxFor(kind: RateLimitKind) {
  const envByKind: Record<RateLimitKind, string> = {
    auth: "RATE_LIMIT_AUTH_MAX",
    upload: "RATE_LIMIT_UPLOAD_MAX",
    analysis_create: "RATE_LIMIT_ANALYSIS_CREATE_MAX",
    export: "RATE_LIMIT_EXPORT_MAX",
    share_create: "RATE_LIMIT_SHARE_CREATE_MAX",
    share_access: "RATE_LIMIT_SHARE_ACCESS_MAX",
    research_desk: "RATE_LIMIT_RESEARCH_DESK_MAX",
    waitlist: "RATE_LIMIT_WAITLIST_MAX",
  };
  const parsed = Number(process.env[envByKind[kind]]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX[kind];
}

function ipFromRequest(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export function rateLimitKey(input: { request?: Request; userId?: string; accountId?: string; email?: string }) {
  if (input.accountId) return `account:${input.accountId}`;
  if (input.userId) return `user:${input.userId}`;
  if (input.email) return `email:${input.email.toLowerCase()}`;
  return `ip:${input.request ? ipFromRequest(input.request) : "unknown"}`;
}

export async function checkRateLimit(input: { route: string; kind: RateLimitKind; key: string }) {
  if (!enabled()) return { allowed: true, count: 0, limit: maxFor(input.kind), windowStart: new Date().toISOString() };
  const limit = maxFor(input.kind);
  const bucketMs = windowMs();
  const windowStart = new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
  const updatedAt = new Date().toISOString();
  let count: number;

  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<{ count: number }>(
      `INSERT INTO rate_limit_buckets (key, route, window_start, count, updated_at)
       VALUES ($1,$2,$3,1,$4)
       ON CONFLICT(key, route, window_start)
       DO UPDATE SET count = rate_limit_buckets.count + 1, updated_at = EXCLUDED.updated_at
       RETURNING count`,
      [input.key, input.route, windowStart, updatedAt],
    );
    count = Number(result.rows[0]?.count ?? 1);
  } else {
    const db = getSqliteRuntimeDb();
    db.prepare(
      `INSERT INTO rate_limit_buckets (key, route, window_start, count, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(key, route, window_start)
       DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    ).run(input.key, input.route, windowStart, updatedAt);
    const row = db.prepare("SELECT count FROM rate_limit_buckets WHERE key = ? AND route = ? AND window_start = ?").get(input.key, input.route, windowStart) as { count: number };
    count = Number(row.count);
  }

  const allowed = count <= limit;
  if (!allowed) {
    logger.warn("rate_limit.exceeded", { route: input.route, key: input.key, count, limit, window_start: windowStart });
  }
  return { allowed, count, limit, windowStart };
}

export async function enforceRateLimit(input: { request?: Request; route: string; kind: RateLimitKind; userId?: string; accountId?: string; email?: string }) {
  const result = await checkRateLimit({ route: input.route, kind: input.kind, key: rateLimitKey(input) });
  if (result.allowed) return undefined;
  return NextResponse.json(
    { error: { code: "rate_limited", message: "Too many requests. Please wait a moment and try again." } },
    { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs() / 1000)) } },
  );
}

export async function countRecentRateLimitEvents(minutes = 60) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  if (getDatabaseProvider() === "postgres") {
    const result = await getPostgresPool().query<{ total: string }>("SELECT COALESCE(SUM(count), 0)::text AS total FROM rate_limit_buckets WHERE updated_at >= $1", [since]);
    return Number(result.rows[0]?.total ?? 0);
  }
  const row = getSqliteRuntimeDb().prepare("SELECT COALESCE(SUM(count), 0) AS total FROM rate_limit_buckets WHERE updated_at >= ?").get(since) as { total: number };
  return Number(row.total ?? 0);
}
