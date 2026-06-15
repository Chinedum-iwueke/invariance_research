import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  ExperimentJobRecord,
  ExperimentPlanItemRecord,
  ExperimentPlanRecord,
  StrategySpecRecord,
} from "../src/lib/server/research-programs/models";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invariance-b6-executor-"));
const bulletproofRoot = "/home/omenka/Projects/bulletproof_bt";

process.env.OBJECT_STORAGE_PROVIDER = "local";
process.env.INVARIANCE_STORAGE_ROOT = path.join(tempDir, "storage");
process.env.INVARIANCE_BULLETPROOF_ROOT = bulletproofRoot;
process.env.INVARIANCE_PYTHON_BIN = process.env.INVARIANCE_PYTHON_BIN || "python3";
process.env.PYTHONPATH = [path.join(bulletproofRoot, "src"), process.env.PYTHONPATH].filter(Boolean).join(":");

async function readJson<T>(relativePath: string): Promise<T> {
  const raw = await fsp.readFile(path.join(bulletproofRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("B6 executor materializes the Bulletproof experiment contract and stores artifacts", async () => {
  const { executeExperimentJob } = await import("../src/lib/server/research-programs/experiment-executor");
  const { getObjectStorage, resetObjectStorageForTests } = await import("../src/lib/server/storage/object-storage");
  const now = "2026-06-13T00:00:00.000Z";
  const strategySpec = await readJson<StrategySpecRecord["spec"]>("examples/strategy_specs/trend_continuation_reference.json");
  const experimentPlan = await readJson<ExperimentPlanRecord["plan"]>("examples/experiment_plans/trend_continuation_plan_reference.json");
  const firstItem = experimentPlan.items[0];
  assert.ok(firstItem);

  const job: ExperimentJobRecord = {
    experiment_job_id: "job-b6-test",
    experiment_plan_item_id: "item-b6-baseline",
    experiment_plan_id: "plan-b6-test",
    program_id: "program-b6-test",
    account_id: "account-b6-test",
    status: "processing",
    priority: 100,
    progress_pct: 15,
    current_step: "Executing",
    retry_count: 0,
    max_attempts: 3,
    available_at: now,
    created_at: now,
    updated_at: now,
  };
  const item: ExperimentPlanItemRecord = {
    experiment_plan_item_id: job.experiment_plan_item_id,
    experiment_plan_id: job.experiment_plan_id,
    program_id: job.program_id,
    account_id: job.account_id,
    item_key: firstItem.item_id,
    experiment_type: firstItem.experiment_type,
    title: firstItem.title,
    status: "queued",
    priority: firstItem.priority,
    required_datasets: firstItem.required_datasets,
    runtime_budget: firstItem.runtime_budget,
    config_patch: firstItem.config_patch,
    falsification_question: firstItem.falsification_question,
    created_at: now,
    queued_at: now,
  };
  const plan: ExperimentPlanRecord = {
    experiment_plan_id: job.experiment_plan_id,
    program_id: job.program_id,
    account_id: job.account_id,
    strategy_spec_record_id: "strategy-record-b6-test",
    hypothesis_version_id: "hypothesis-version-b6-test",
    status: "queued",
    plan: experimentPlan,
    validation_errors: [],
    created_by_user_id: "user-b6-test",
    created_at: now,
    approved_at: now,
    approved_by_user_id: "user-b6-test",
    queued_at: now,
  };
  const strategy: StrategySpecRecord = {
    strategy_spec_record_id: plan.strategy_spec_record_id,
    program_id: job.program_id,
    account_id: job.account_id,
    hypothesis_version_id: plan.hypothesis_version_id,
    version: 1,
    status: "approved",
    spec: strategySpec,
    validation_errors: [],
    created_by_user_id: "user-b6-test",
    created_at: now,
    approved_at: now,
    approved_by_user_id: "user-b6-test",
  };

  const result = await executeExperimentJob({ job, plan, item, strategy });

  assert.equal(result.status, "completed");
  const artifactNames = result.artifacts.map((artifact) => path.basename(artifact.storage_key)).sort();
  assert.ok(artifactNames.length >= 15);
  assert.deepEqual(
    ["FailureCauseCard.json", "NextExperimentCard.json", "RunQualityCard.json", "VerdictCard.json", "cards.json", "cards.md", "execution_log.md", "execution_manifest.json", "run_config.json", "verdict.json"]
      .every((name) => artifactNames.includes(name)),
    true,
  );
  assert.equal(result.card_summary?.schema_version, "strategy_research_terminal.bundle.v1");
  assert.equal(result.card_summary?.card_count, 9);
  assert.equal(result.card_summary?.verdict, "ready_for_engine_execution");
  assert.equal(result.card_summary?.decision_grade, false);
  assert.ok(
    result.artifacts.every((artifact) =>
      artifact.storage_key.startsWith("analysis-artifacts/account-b6-test/programs/program-b6-test/experiments/job-b6-test/"),
    ),
  );
  assert.equal((result.engine_payload.manifest as { schema_version?: string })?.schema_version, "experiment_execution_manifest_v1");
  assert.equal((result.engine_payload.manifest as { status?: string })?.status, "contract_ready");

  const manifestArtifact = result.artifacts.find((artifact) => artifact.storage_key.endsWith("/execution_manifest.json"));
  assert.ok(manifestArtifact);
  const storedManifest = JSON.parse(Buffer.from(await getObjectStorage().getObject(manifestArtifact.storage_key)).toString("utf8")) as {
    experiment_item_id?: string;
    status?: string;
  };
  assert.equal(storedManifest.experiment_item_id, "baseline");
  assert.equal(storedManifest.status, "contract_ready");

  const cardsArtifact = result.artifacts.find((artifact) => artifact.storage_key.endsWith("/cards.json"));
  assert.ok(cardsArtifact);
  const storedCards = JSON.parse(Buffer.from(await getObjectStorage().getObject(cardsArtifact.storage_key)).toString("utf8")) as {
    schema_version?: string;
    cards?: Array<{ card_type?: string }>;
  };
  assert.equal(storedCards.schema_version, "strategy_research_terminal.bundle.v1");
  assert.equal(storedCards.cards?.some((card) => card.card_type === "ParameterFragilityCard"), true);
  resetObjectStorageForTests();
});

test("B7 failure card packet is stored for terminal experiment failures", async () => {
  const { uploadExperimentFailureCards } = await import("../src/lib/server/research-programs/experiment-executor");
  const { getObjectStorage, resetObjectStorageForTests } = await import("../src/lib/server/storage/object-storage");
  const now = "2026-06-13T00:00:00.000Z";
  const job: ExperimentJobRecord = {
    experiment_job_id: "job-b7-failure-test",
    experiment_plan_item_id: "item-b7-failure",
    experiment_plan_id: "plan-b7-failure",
    program_id: "program-b7-failure",
    account_id: "account-b7-failure",
    status: "processing",
    priority: 10,
    progress_pct: 50,
    current_step: "Executing",
    retry_count: 2,
    max_attempts: 3,
    available_at: now,
    created_at: now,
    updated_at: now,
  };

  const result = await uploadExperimentFailureCards({ job, error: "experiment_execution_failed: missing market data profile" });

  assert.equal(result.card_summary?.verdict, "execution_failed");
  assert.equal(result.card_summary?.recommended_action, "repair_execution_failure");
  assert.ok(result.artifacts.some((artifact) => artifact.storage_key.endsWith("/FailureCauseCard.json")));
  const cardsArtifact = result.artifacts.find((artifact) => artifact.storage_key.endsWith("/cards.json"));
  assert.ok(cardsArtifact);
  const storedCards = JSON.parse(Buffer.from(await getObjectStorage().getObject(cardsArtifact.storage_key)).toString("utf8")) as {
    cards?: Array<{ card_type?: string }>;
  };
  assert.equal(storedCards.cards?.some((card) => card.card_type === "FailureCauseCard"), true);
  resetObjectStorageForTests();
});
