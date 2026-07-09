import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("Cx assistant provider layer stores OpenAI BYOK and routes researchChat through the account key", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-cx-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "cx.sqlite");
  process.env.INVARIANCE_STORAGE_ROOT = path.join(root, "storage");
  process.env.LLM_RESEARCH_ASSISTANT_ENABLED = "false";
  process.env.LLM_INSIGHTS_ENABLED = "false";
  process.env.LLM_CREDENTIAL_ENCRYPTION_KEY = "test-llm-credential-encryption-key-123";
  process.env.ADMIN_EMAILS = "";

  const originalFetch = globalThis.fetch;
  const seenAuth: string[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seenAuth.push(headers.get("authorization") ?? "");
    return new Response(JSON.stringify({
      choices: [{ message: { content: "{\"ok\":true}" } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const [{ accountService }, { saveOpenAiConnection }, { researchChat }, { closeDbForTests }] = await Promise.all([
    import("../src/lib/server/accounts/service"),
    import("../src/lib/server/llm-connections/service"),
    import("../src/lib/server/llm/chat-provider"),
    import("../src/lib/server/persistence/database"),
  ]);

  try {
    const identity = await accountService.ensureUserAndAccount({ email: "cx-provider@example.com", name: "CX Provider", emailVerified: true });
    const connection = await saveOpenAiConnection({
      accountId: identity.account.account_id,
      userId: identity.user.user_id,
      apiKey: "sk-test-account-openai-key-1234567890",
      model: "gpt-4.1-mini",
      validate: false,
    });
    assert.equal(connection.provider, "openai");
    assert.equal(connection.status, "active");
    assert.equal(connection.credential_ciphertext, undefined);

    const result = await researchChat({
      accountId: identity.account.account_id,
      messages: [{ role: "user", content: "Return JSON." }],
      jsonSchema: { type: "object" },
    });
    assert.equal(result.provider, "openai_byok");
    assert.equal(result.model, "gpt-4.1-mini");
    assert.deepEqual(seenAuth, ["Bearer sk-test-account-openai-key-1234567890"]);
  } finally {
    globalThis.fetch = originalFetch;
    closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
