import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("C0.5 persists a complete conversation, proposal decision, source, and usage trail", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-c05-"));
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.INVARIANCE_DB_PATH = path.join(root, "copilot.sqlite");
  process.env.INVARIANCE_STORAGE_ROOT = path.join(root, "storage");
  process.env.LLM_RESEARCH_ASSISTANT_ENABLED = "false";
  process.env.LLM_INSIGHTS_ENABLED = "false";
  process.env.ADMIN_EMAILS = "";
  process.env.INVARIANCE_PLATFORM_PAUSED = "false";
  process.env.INVARIANCE_ASSISTANT_PAUSED = "false";

  const [{ accountService }, programService, copilotService, { researchCopilotRepository }, { closeDbForTests }] = await Promise.all([
    import("../src/lib/server/accounts/service"),
    import("../src/lib/server/research-programs/service"),
    import("../src/lib/server/research-copilot/service"),
    import("../src/lib/server/research-copilot/repository"),
    import("../src/lib/server/persistence/database"),
  ]);

  try {
    const identity = await accountService.ensureUserAndAccount({ email: "copilot.integration@example.com", name: "Copilot Test", emailVerified: true });
    const program = await programService.createResearchProgram({
      account_id: identity.account.account_id,
      owner_user_id: identity.user.user_id,
      title: "Liquidation continuation",
      thesis: "Test whether forced liquidation shocks create short-horizon BTC continuation.",
      market: "crypto",
    });

    const initial = await copilotService.getProgramConversationDetail({ programId: program.program_id, accountId: identity.account.account_id, userId: identity.user.user_id });
    assert.equal(initial?.messages.length, 1);

    const turn = await copilotService.sendProgramCopilotMessage({
      programId: program.program_id,
      accountId: identity.account.account_id,
      userId: identity.user.user_id,
      content: "I think BTC continues after liquidation spikes. I do not know which exit should be tested first.",
    });
    assert.equal(turn.mode, "exploratory");
    assert.equal(turn.proposals.length, 1);

    await copilotService.decideProgramProposal({
      programId: program.program_id,
      accountId: identity.account.account_id,
      userId: identity.user.user_id,
      proposalId: turn.proposals[0].proposal_id,
      decision: "confirmed",
    });

    const uploaded = await copilotService.uploadProgramSource({
      programId: program.program_id,
      accountId: identity.account.account_id,
      userId: identity.user.user_id,
      title: "Trader transcript",
      fileName: "transcript.txt",
      contentType: "text/plain",
      sourceType: "transcript",
      bytes: new TextEncoder().encode("[00:10] The setup waits for a liquidation impulse.\n\n[00:24] Entry occurs after a closed displacement bar."),
    });
    assert.equal(uploaded.source.status, "ready");
    assert.ok(uploaded.chunks.length >= 1);
    assert.equal(uploaded.chunks[0].anchor.start_seconds, 10);

    const detail = await researchCopilotRepository.getDetail(program.program_id);
    assert.equal(detail?.messages.filter((message) => message.role === "user").length, 1);
    assert.equal(detail?.messages.filter((message) => message.role === "assistant").length, 2);
    assert.equal(detail?.proposals[0].status, "confirmed");
    assert.equal(detail?.sources.length, 1);
    assert.equal((await accountService.getUsage(identity.account.account_id)).assistant_calls, 1);
  } finally {
    closeDbForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
