import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ExperimentJobEventRecord } from "../src/lib/server/research-programs/models";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-b8-memory-"));
process.env.INVARIANCE_DB_PATH = path.join(tempDir, "test.sqlite");
process.env.DATABASE_PROVIDER = "sqlite";
process.env.OBJECT_STORAGE_PROVIDER = "local";
process.env.NODE_ENV = "development";

let getDb: typeof import("../src/lib/server/persistence/database").getDb;
let closeDbForTests: typeof import("../src/lib/server/persistence/database").closeDbForTests;
let deriveMemoryFromExperimentEvent: typeof import("../src/lib/server/research-memory/service").deriveMemoryFromExperimentEvent;
let searchResearchMemory: typeof import("../src/lib/server/research-memory/service").searchResearchMemory;
let listResearchMemory: typeof import("../src/lib/server/research-memory/service").listResearchMemory;
let researchMemoryRepository: typeof import("../src/lib/server/research-memory/repository").researchMemoryRepository;
let accountService: typeof import("../src/lib/server/accounts/service").accountService;
let researchProgramRepository: typeof import("../src/lib/server/research-programs/repository").researchProgramRepository;

function resetDb() {
  getDb().exec(`
    DELETE FROM similar_run_index;
    DELETE FROM program_recommendations;
    DELETE FROM research_findings;
    DELETE FROM research_memory_links;
    DELETE FROM research_memory_items;
    DELETE FROM program_events;
    DELETE FROM program_members;
    DELETE FROM research_programs;
    DELETE FROM accounts;
    DELETE FROM users;
  `);
}

function event(accountId = "account-memory", programId = "program-memory"): ExperimentJobEventRecord {
  return {
    experiment_job_event_id: "event-memory-1",
    experiment_job_id: "job-memory-1",
    experiment_plan_id: "plan-memory-1",
    program_id: programId,
    account_id: accountId,
    event_type: "completed",
    message: "Experiment completed.",
    created_at: "2026-06-13T00:00:00.000Z",
    payload: {
      card_summary: {
        schema_version: "strategy_research_terminal.bundle.v1",
        card_count: 3,
        verdict: "ready_for_engine_execution",
        confidence: "protocol_validated",
        decision_grade: false,
        recommended_action: "execute_market_data_run",
        warning_count: 1,
        cards: [
          {
            card_type: "VerdictCard",
            status: "contract_ready",
            summary: "Protocol is valid, but no market execution has been run.",
            data: {
              verdict: "ready_for_engine_execution",
              status: "contract_ready",
              confidence: "protocol_validated",
              decision_grade: false,
              summary: "Protocol is valid, but no market execution has been run.",
            },
            warnings: ["No market execution artifacts."],
          },
          {
            card_type: "FailureCauseCard",
            status: "contract_ready",
            summary: "No failure detected.",
            data: { failure_detected: false, status: "contract_ready", summary: "No failure detected." },
            warnings: [],
          },
          {
            card_type: "NextExperimentCard",
            summary: "Bind a data profile and execute.",
            data: {
              recommended_action: "execute_market_data_run",
              next_action: "Bind a data profile and execute.",
            },
            warnings: [],
          },
        ],
      },
    },
  };
}

test.before(async () => {
  ({ getDb, closeDbForTests } = await import("../src/lib/server/persistence/database"));
  ({ deriveMemoryFromExperimentEvent, searchResearchMemory, listResearchMemory } = await import("../src/lib/server/research-memory/service"));
  ({ researchMemoryRepository } = await import("../src/lib/server/research-memory/repository"));
  ({ accountService } = await import("../src/lib/server/accounts/service"));
  ({ researchProgramRepository } = await import("../src/lib/server/research-programs/repository"));
});

test.beforeEach(() => resetDb());

test.after(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("B8 derives memory items, findings, recommendations, and similarity signatures from verdict cards", () => {
  const batch = deriveMemoryFromExperimentEvent(event());

  assert.equal(batch.items.length, 3);
  assert.equal(batch.findings.length, 2);
  assert.equal(batch.recommendations.length, 1);
  assert.equal(batch.similar.length, 1);
  assert.equal(batch.items.some((item) => item.memory_type === "verdict"), true);
  assert.equal(batch.recommendations[0].recommendation_type, "execute_market_data_run");
});

test("B8 memory repository is tenant scoped for list and search", async () => {
  const { user: userA, account: accountA } = await accountService.ensureUserAndAccount({ email: "memory-a@example.com" });
  const { user: userB, account: accountB } = await accountService.ensureUserAndAccount({ email: "memory-b@example.com" });
  const now = "2026-06-13T00:00:00.000Z";
  await researchProgramRepository.save({
    program_id: "program-a",
    account_id: accountA.account_id,
    owner_user_id: userA.user_id,
    title: "Program A",
    thesis: "A",
    status: "active",
    next_action: "Test",
    created_at: now,
    updated_at: now,
  });
  await researchProgramRepository.save({
    program_id: "program-b",
    account_id: accountB.account_id,
    owner_user_id: userB.user_id,
    title: "Program B",
    thesis: "B",
    status: "active",
    next_action: "Test",
    created_at: now,
    updated_at: now,
  });
  await researchMemoryRepository.saveBatch({
    items: [
      {
        memory_item_id: "mem-a",
        account_id: accountA.account_id,
        program_id: "program-a",
        memory_type: "verdict",
        title: "Alpha verdict",
        summary: "Private alpha failure",
        status: "failed",
        confidence: 0.2,
        source: {},
        tags: ["private_alpha"],
        created_at: now,
        updated_at: now,
      },
      {
        memory_item_id: "mem-b",
        account_id: accountB.account_id,
        program_id: "program-b",
        memory_type: "verdict",
        title: "Beta verdict",
        summary: "Private beta failure",
        status: "failed",
        confidence: 0.2,
        source: {},
        tags: ["private_beta"],
        created_at: now,
        updated_at: now,
      },
    ],
    links: [],
    findings: [],
    recommendations: [],
    similar: [],
  });

  const snapshotA = await listResearchMemory(accountA.account_id);
  assert.deepEqual(snapshotA.items.map((item) => item.memory_item_id), ["mem-a"]);
  const searchA = await searchResearchMemory(accountA.account_id, "private");
  assert.deepEqual(searchA.map((item) => item.memory_item_id), ["mem-a"]);
  const betaFromA = await searchResearchMemory(accountA.account_id, "beta");
  assert.deepEqual(betaFromA, []);
});
