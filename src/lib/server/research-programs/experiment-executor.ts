import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type {
  ExperimentJobRecord,
  ExperimentPlanItemRecord,
  ExperimentPlanRecord,
  StrategySpecRecord,
} from "@/lib/server/research-programs/models";
import { getObjectStorage, type StoredObject } from "@/lib/server/storage/object-storage";
import { buildExperimentArtifactObjectKey } from "@/lib/server/storage/object-keys";
import { buildFailureCardBundle, renderExperimentCardsMarkdown, summarizeExperimentCardBundle } from "@/lib/server/research-programs/experiment-cards";

export type ExperimentExecutionResult = {
  status: "completed";
  stdout: string;
  stderr: string;
  engine_payload: Record<string, unknown>;
  artifacts: StoredObject[];
  card_summary?: ReturnType<typeof summarizeExperimentCardBundle>;
};

function pythonBin() {
  return process.env.INVARIANCE_PYTHON_BIN?.trim() || "python3";
}

function timeoutMs(item: ExperimentPlanItemRecord) {
  const env = Number(process.env.INVARIANCE_EXPERIMENT_JOB_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return Math.max(60_000, item.runtime_budget.max_minutes * 60_000);
}

function extractJson(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

async function runBtExperimentExecute(input: {
  strategyPath: string;
  planPath: string;
  itemId: string;
  outputDir: string;
  runtimeLimits: Record<string, unknown>;
  timeoutMs: number;
}) {
  const args = [
    "-m",
    "bt.cli",
    "experiment",
    "execute",
    "--strategy-spec",
    input.strategyPath,
    "--experiment-plan",
    input.planPath,
    "--item-id",
    input.itemId,
    "--output-dir",
    input.outputDir,
    "--runtime-limits-json",
    JSON.stringify(input.runtimeLimits),
  ];
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(pythonBin(), args, {
      cwd: process.env.INVARIANCE_BULLETPROOF_ROOT || process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("experiment_execution_timeout"));
    }, input.timeoutMs);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) {
        reject(new Error(`experiment_execution_failed:${err || out || `exit_${code}`}`));
        return;
      }
      resolve({ stdout: out, stderr: err });
    });
  });
}

async function uploadOutputFiles(input: {
  accountId: string;
  programId: string;
  jobId: string;
  outputDir: string;
}) {
  const storage = getObjectStorage();
  const entries = await fs.readdir(input.outputDir, { withFileTypes: true });
  const stored: StoredObject[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(input.outputDir, entry.name);
    const bytes = new Uint8Array(await fs.readFile(absolute));
    const contentType = entry.name.endsWith(".json") ? "application/json" : entry.name.endsWith(".md") ? "text/markdown" : "application/octet-stream";
    stored.push(
      await storage.putObject({
        bucket: "analysis-artifacts",
        file_name: entry.name,
        content_type: contentType,
        bytes,
        storage_key: buildExperimentArtifactObjectKey({
          accountId: input.accountId,
          programId: input.programId,
          jobId: input.jobId,
          fileName: entry.name,
        }),
      }),
    );
  }
  return stored;
}

export async function executeExperimentJob(input: {
  job: ExperimentJobRecord;
  plan: ExperimentPlanRecord;
  item: ExperimentPlanItemRecord;
  strategy: StrategySpecRecord;
}): Promise<ExperimentExecutionResult> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `ir-experiment-${input.job.experiment_job_id}-`));
  try {
    const strategyPath = path.join(tmp, "strategy_spec.json");
    const planPath = path.join(tmp, "experiment_plan.json");
    const outputDir = path.join(tmp, "outputs");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(strategyPath, JSON.stringify(input.strategy.spec, null, 2), "utf8");
    await fs.writeFile(planPath, JSON.stringify(input.plan.plan, null, 2), "utf8");
    const runtimeLimits = {
      max_minutes: input.item.runtime_budget.max_minutes,
      max_variants: input.item.runtime_budget.max_variants,
      job_id: input.job.experiment_job_id,
      account_id: input.job.account_id,
      program_id: input.job.program_id,
    };
    const { stdout, stderr } = await runBtExperimentExecute({
      strategyPath,
      planPath,
      itemId: input.item.item_key,
      outputDir,
      runtimeLimits,
      timeoutMs: timeoutMs(input.item),
    });
    const enginePayload = extractJson(stdout);
    const artifacts = await uploadOutputFiles({
      accountId: input.job.account_id,
      programId: input.job.program_id,
      jobId: input.job.experiment_job_id,
      outputDir,
    });
    return {
      status: "completed",
      stdout,
      stderr,
      engine_payload: enginePayload,
      artifacts,
      card_summary: summarizeExperimentCardBundle(enginePayload["cards"]),
    };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

export async function uploadExperimentFailureCards(input: {
  job: ExperimentJobRecord;
  error: string;
}): Promise<{ artifacts: StoredObject[]; card_summary?: ReturnType<typeof summarizeExperimentCardBundle> }> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `ir-experiment-failure-${input.job.experiment_job_id}-`));
  try {
    const bundle = buildFailureCardBundle({ job: input.job, error: input.error });
    await fs.writeFile(path.join(tmp, "cards.json"), JSON.stringify(bundle, null, 2), "utf8");
    await fs.writeFile(path.join(tmp, "cards.md"), renderExperimentCardsMarkdown(bundle), "utf8");
    for (const card of bundle.cards) {
      await fs.writeFile(path.join(tmp, `${card.card_type}.json`), JSON.stringify(card, null, 2), "utf8");
    }
    const artifacts = await uploadOutputFiles({
      accountId: input.job.account_id,
      programId: input.job.program_id,
      jobId: input.job.experiment_job_id,
      outputDir: tmp,
    });
    return { artifacts, card_summary: summarizeExperimentCardBundle(bundle) };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
