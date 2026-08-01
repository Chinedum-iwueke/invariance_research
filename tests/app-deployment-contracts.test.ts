import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";

import { validateAppDeploymentConfig } from "../src/lib/server/ops/app-deployment-config";
import {
  getLivenessSnapshot,
  runWebReadinessChecks,
} from "../src/lib/server/ops/web-health-service";

const root = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function validProductionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_DEPLOYMENT_STAGE: "production",
    APP_URL: "https://www.invarianceresearch.xyz",
    AUTH_URL: "https://www.invarianceresearch.xyz",
    NEXTAUTH_URL: "https://www.invarianceresearch.xyz",
    AUTH_SECRET: "auth-key-9351-with-more-than-thirty-two-characters",
    NEXTAUTH_SECRET: "auth-key-9351-with-more-than-thirty-two-characters",
    GOOGLE_CLIENT_ID: "google-client-9351.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "google-oauth-value-9351",
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: "postgresql://invariance_app:db-pass-9351@pgbouncer-app:6432/invariance_research?sslmode=verify-full",
    NODE_EXTRA_CA_CERTS: "/etc/invariance/db-ca.crt",
    POSTGRES_SCHEMA_AUTO_INIT: "false",
    POSTGRES_POOL_MAX: "5",
    WORKER_MODE: "external",
    ALLOW_EMBEDDED_WORKERS: "false",
    INVARIANCE_EMBEDDED_WORKERS: "false",
    OBJECT_STORAGE_PROVIDER: "r2",
    OBJECT_STORAGE_BUCKET: "invariance-research-prod",
    OBJECT_STORAGE_ENDPOINT: "https://9351.r2.cloudflarestorage.com",
    OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access-9351",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-private-value-9351",
    OBJECT_STORAGE_LIFECYCLE_CONFIGURED: "true",
    STRIPE_SECRET_KEY: "sk_live_9351abcdef",
    STRIPE_WEBHOOK_SECRET: "whsec_9351abcdef",
    STRIPE_PRICE_EXPLORER: "price_9351explorer",
    STRIPE_PRICE_PRO: "price_9351pro",
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: "Invariance Research <reports@invarianceresearch.xyz>",
    RESEND_API_KEY: "re_9351abcdef",
    LLM_CREDENTIAL_ENCRYPTION_KEY: "llm-key-9351-with-more-than-thirty-two-characters",
    EXCHANGE_CREDENTIAL_ENCRYPTION_KEY: "exchange-key-9351-with-more-than-thirty-two-characters",
    RATE_LIMITS_ENABLED: "true",
    LLM_RESEARCH_ASSISTANT_ENABLED: "false",
  };
}

test("Next.js emits a standalone production server", () => {
  const config = source("next.config.ts");
  assert.match(config, /output:\s*["']standalone["']/);
  assert.match(config, /outputFileTracingExcludes/);
  assert.match(config, /\.\/\.data\/\*\*\/\*/);
  assert.match(config, /poweredByHeader:\s*false/);
});

test("application image is multi-stage, non-root, and contains only standalone output", () => {
  const dockerfile = source("Dockerfile.app");
  assert.match(dockerfile, /FROM base AS builder/);
  assert.match(dockerfile, /FROM base AS operations/);
  assert.match(dockerfile, /FROM node:\$\{NODE_VERSION\} AS runner/);
  assert.match(dockerfile, /\/app\/\.next\/standalone/);
  assert.match(dockerfile, /\/app\/\.next\/static/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /chown -R nextjs:nodejs \/app\/\.next\/cache/);
  assert.match(dockerfile, /RUN npm run build:app/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.doesNotMatch(dockerfile, /apt-get|python3|bulletproof_bt/);
});

test("operations image and service unit support explicit migrations and boot recovery", () => {
  const dockerfile = source("Dockerfile.app");
  const release = source("deploy/release.env.example");
  const service = source("deploy/invariance-web.service");
  assert.match(dockerfile, /CMD \["npm", "run", "db:init:postgres"\]/);
  assert.match(release, /^MIGRATION_IMAGE=/m);
  assert.match(service, /Requires=docker\.service invariance-postgres\.service/);
  assert.match(service, /ExecStartPre=.*config --quiet/);
  assert.match(service, /ExecStart=.*up -d --remove-orphans/);
  assert.match(service, /ConditionPathExists=\/etc\/invariance\/app\/app\.env/);
});

test("Docker context excludes secrets, local state, tests, and development dependencies", () => {
  const dockerignore = source(".dockerignore");
  for (const entry of [".git", ".next", "*.tsbuildinfo", "node_modules", ".data", ".debug-analysis", ".env.*", "tests", "src/__tests__"]) {
    assert.match(dockerignore, new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

test("application Compose contract exposes only loopback web ports and private database networking", () => {
  const compose = YAML.parse(source("deploy/docker-compose.app.yml"), { merge: true }) as Record<string, any>;
  assert.deepEqual(compose.services["web-a"].ports, ["127.0.0.1:3101:3000"]);
  assert.deepEqual(compose.services["web-b"].ports, ["127.0.0.1:3102:3000"]);
  assert.equal(compose.networks["data-private"].external, true);
  assert.equal(compose.networks["data-private"].name, "invariance-data-private");
  assert.equal(compose.services["web-a"].read_only, true);
  assert.equal(compose.services["web-b"].read_only, true);
  assert.deepEqual(compose.services["web-a"].cap_drop, ["ALL"]);
  assert.match(JSON.stringify(compose.services["web-a"].healthcheck), /api\/health\/live/);
  assert.doesNotMatch(JSON.stringify(compose), /docker\.sock|0\.0\.0\.0:310/);
});

test("Caddy routes only to loopback replicas and checks dependency-free liveness", () => {
  const caddy = source("deploy/Caddyfile.app");
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:3101 127\.0\.0\.1:3102/);
  assert.match(caddy, /health_uri \/api\/health\/live/);
  assert.match(caddy, /max_size 55MB/);
  assert.match(caddy, /tls \/etc\/caddy\/certs\/origin\.pem/);
});

test("liveness is process-local and always reports the web service identity", () => {
  const snapshot = getLivenessSnapshot();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.service, "invariance-web");
  assert.ok(snapshot.uptime_seconds >= 0);
});

test("readiness reports healthy only when every required web check passes", async () => {
  const ready = await runWebReadinessChecks({
    checkDatabase: async () => undefined,
    checkSchema: async () => undefined,
    checkRuntime: async () => undefined,
    checkStorageConfig: async () => undefined,
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.status, "healthy");
  assert.equal(ready.checks.length, 4);

  const unavailable = await runWebReadinessChecks({
    checkDatabase: async () => {
      throw new Error("postgresql://user:password@private-host/database");
    },
    checkSchema: async () => undefined,
    checkRuntime: async () => undefined,
    checkStorageConfig: async () => undefined,
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.status, "unhealthy");
  assert.equal(unavailable.checks.find((check) => check.name === "database")?.detail, "database_unavailable");
  assert.doesNotMatch(JSON.stringify(unavailable), /password|private-host/);
});

test("production configuration validator accepts the intended deployment contract", () => {
  const result = validateAppDeploymentConfig(validProductionEnv());
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.issues, []);
});

test("preview configuration requires Stripe test mode", () => {
  const env = validProductionEnv();
  env.APP_DEPLOYMENT_STAGE = "preview";
  env.STRIPE_SECRET_KEY = "sk_test_9351abcdef";

  const result = validateAppDeploymentConfig(env);
  assert.equal(result.ok, true, JSON.stringify(result.issues));

  env.STRIPE_SECRET_KEY = "sk_live_9351abcdef";
  const unsafe = validateAppDeploymentConfig(env);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.issues.some((issue) => issue.code === "stripe_not_test"), true);
});

test("production configuration validator rejects unsafe deployment state", () => {
  const env = validProductionEnv();
  env.DATABASE_URL = "postgresql://invariance_app:password@localhost:5432/invariance_research?sslmode=require";
  env.POSTGRES_SCHEMA_AUTO_INIT = "true";
  env.WORKER_MODE = "embedded";
  env.ALLOW_EMBEDDED_WORKERS = "true";
  env.OBJECT_STORAGE_PROVIDER = "local";
  env.RATE_LIMITS_ENABLED = "false";

  const result = validateAppDeploymentConfig(env);
  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((issue) => issue.code));
  for (const code of [
    "database_tls_not_verified",
    "database_host_invalid",
    "schema_auto_init_enabled",
    "worker_mode_invalid",
    "embedded_workers_enabled",
    "object_storage_provider_invalid",
    "rate_limits_disabled",
  ]) {
    assert.equal(codes.has(code), true, `missing ${code}`);
  }
});

test("full platform health delegates engine probing when workers are external", () => {
  const startupValidation = source("src/lib/server/ops/startup-validation.ts");
  assert.match(startupValidation, /getWorkerMode\(\) === "external"/);
  assert.match(startupValidation, /delegated_to_external_worker/);
  assert.match(startupValidation, /external_engine_worker_heartbeat_fresh/);
});

test("production diagnostics require an incident-only token", () => {
  for (const route of ["src/app/api/debug/db-env/route.ts", "src/app/api/debug/tls-check/route.ts"]) {
    const diagnostic = source(route);
    assert.match(diagnostic, /DEBUG_RUNTIME_ENV_TOKEN/);
    assert.match(diagnostic, /process\.env\.NODE_ENV === ["']production["']/);
    assert.match(diagnostic, /status: 404/);
    assert.match(diagnostic, /authorization/);
  }
});

test("standalone validation rejects local state and worker runtime leakage", () => {
  const validator = source("scripts/validate-standalone-output.ts");
  for (const forbidden of [".data", ".debug-analysis", "run_bulletproof_engine.py", "run-analysis-worker.ts", "Dockerfile.worker"]) {
    assert.match(validator, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(validator, /STANDALONE_MAX_BYTES/);
});
