import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { credentialHint, decryptExchangeCredentials, encryptExchangeCredentials } from "../src/lib/server/research-c3/credential-vault";

test("C3 connector credentials use authenticated encryption and never expose the full key hint", () => {
  process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY = "c3-test-key-that-is-deliberately-longer-than-thirty-two-characters";
  const encrypted = encryptExchangeCredentials({ api_key: "binance-key-12345678", api_secret: "super-secret" });
  assert.ok(encrypted.startsWith("v1."));
  assert.ok(!encrypted.includes("super-secret"));
  assert.deepEqual(decryptExchangeCredentials(encrypted), { api_key: "binance-key-12345678", api_secret: "super-secret" });
  assert.equal(credentialHint("binance-key-12345678"), "bina••••5678");
});

test("C3 migrations, worker, APIs, and UI cover the complete durable control plane", () => {
  const migrations = fs.readFileSync("src/lib/server/persistence/migrations.ts", "utf8");
  const compose = fs.readFileSync("deploy/docker-compose.worker.yml", "utf8");
  const ui = fs.readFileSync("src/components/research-programs/deployment-command-center.tsx", "utf8");
  const worker = fs.readFileSync("src/lib/server/workers/execution-worker.ts", "utf8");
  for (const table of ["exchange_connectors", "strategy_deployments", "deployment_commands", "deployment_events", "deployment_projections"]) assert.match(migrations, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(compose, /execution-worker:/);
  for (const venue of ["Bybit", "Binance"]) assert.match(ui, new RegExp(venue));
  for (const command of ["start", "pause", "freeze", "reconcile", "stop"]) assert.match(ui, new RegExp(command));
  assert.match(worker, /decryptExchangeCredentials/);
  assert.match(worker, /authoritative_source:"exchange_rest"/);
});

test("C3 tenant-scoped connector persistence returns redacted records", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-c3-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "c3.sqlite");
  process.env.EXCHANGE_CREDENTIAL_ENCRYPTION_KEY = "c3-test-key-that-is-deliberately-longer-than-thirty-two-characters";
  const [{ accountService }, programs, service, persistence] = await Promise.all([
    import("../src/lib/server/accounts/service"),
    import("../src/lib/server/research-programs/service"),
    import("../src/lib/server/research-c3/service"),
    import("../src/lib/server/persistence/database"),
  ]);
  try {
    const identity = await accountService.ensureUserAndAccount({ email: "c3@example.com", name: "C3", emailVerified: true });
    const program = await programs.createResearchProgram({ account_id: identity.account.account_id, owner_user_id: identity.user.user_id, title: "C3 deployment", thesis: "Test supervised deployment.", market: "crypto" });
    const created = await service.createExchangeConnector({ accountId: identity.account.account_id, userId: identity.user.user_id, venue: "binance", environment: "demo", productType: "spot", label: "Binance testnet", apiKey: "test-key-12345678", apiSecret: "test-secret", withdrawalsDisabled: true });
    assert.equal(created.status, "pending");
    const detail = await service.getC3Detail(program.program_id, identity.account.account_id);
    assert.equal(detail.connectors.length, 1);
    assert.equal(detail.connectors[0].api_key_hint, "test••••5678");
    assert.equal(detail.connectors[0].product_type, "spot");
    assert.equal("credential_ciphertext" in detail.connectors[0], false);
  } finally {
    persistence.closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
