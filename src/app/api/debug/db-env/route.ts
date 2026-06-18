import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function readToken(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || request.nextUrl.searchParams.get("token") || "";
}

function parseDatabaseUrl(raw: string | undefined) {
  if (!raw) {
    return {
      present: false,
      parseable: false,
    };
  }

  try {
    const url = new URL(raw);
    return {
      present: true,
      parseable: true,
      hash: hashValue(raw),
      protocol: url.protocol.replace(":", ""),
      username: decodeURIComponent(url.username),
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, "") || null,
      sslmode: url.searchParams.get("sslmode"),
      uselibpqcompat: url.searchParams.get("uselibpqcompat"),
      has_password: url.password.length > 0,
    };
  } catch (error) {
    return {
      present: true,
      parseable: false,
      hash: hashValue(raw),
      error: error instanceof Error ? error.message : "database_url_parse_failed",
    };
  }
}

export async function GET(request: NextRequest) {
  const requiredToken = process.env.DEBUG_RUNTIME_ENV_TOKEN;
  if (requiredToken && readToken(request) !== requiredToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!requiredToken && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "debug_runtime_env_token_required",
        message: "Set DEBUG_RUNTIME_ENV_TOKEN to enable this diagnostic in production.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV || null,
    database_provider: process.env.DATABASE_PROVIDER || null,
    postgres_pool_max: process.env.POSTGRES_POOL_MAX || null,
    postgres_schema_auto_init: process.env.POSTGRES_SCHEMA_AUTO_INIT || null,
    database_url: parseDatabaseUrl(process.env.DATABASE_URL),
  });
}
