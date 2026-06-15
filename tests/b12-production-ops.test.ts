import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssistantAccepting,
  assertQueueAccepting,
  getOperationControls,
  isOperationalPauseError,
} from "../src/lib/server/ops/operations-policy";
import { checkRateLimit } from "../src/lib/server/rate-limits";

const pauseKeys = [
  "INVARIANCE_PLATFORM_PAUSED",
  "INVARIANCE_QUEUE_PAUSED",
  "INVARIANCE_ANALYSIS_QUEUE_PAUSED",
  "INVARIANCE_EXPORT_QUEUE_PAUSED",
  "INVARIANCE_EXPERIMENT_QUEUE_PAUSED",
  "INVARIANCE_ASSISTANT_PAUSED",
];

test.afterEach(() => {
  for (const key of pauseKeys) delete process.env[key];
  delete process.env.RATE_LIMITS_ENABLED;
});

test("B12 operation controls expose queue and assistant kill switches", () => {
  process.env.INVARIANCE_EXPERIMENT_QUEUE_PAUSED = "true";
  process.env.INVARIANCE_ASSISTANT_PAUSED = "true";

  const controls = getOperationControls();
  assert.equal(controls.analysis_queue_paused, false);
  assert.equal(controls.export_queue_paused, false);
  assert.equal(controls.experiment_queue_paused, true);
  assert.equal(controls.assistant_paused, true);

  assert.doesNotThrow(() => assertQueueAccepting("analysis"));
  assert.throws(() => assertQueueAccepting("experiment"), /experiment_queue_paused/);
  assert.throws(() => assertAssistantAccepting(), /assistant_paused/);
  assert.equal(isOperationalPauseError("experiment_queue_paused"), true);
});

test("B12 platform pause stops every intake surface", () => {
  process.env.INVARIANCE_PLATFORM_PAUSED = "true";
  const controls = getOperationControls();
  assert.equal(controls.global_paused, true);
  assert.equal(controls.analysis_queue_paused, true);
  assert.equal(controls.export_queue_paused, true);
  assert.equal(controls.experiment_queue_paused, true);
  assert.equal(controls.assistant_paused, true);
});

test("B12 research pipeline has rate-limit buckets for assistant and experiment queue", async () => {
  process.env.RATE_LIMITS_ENABLED = "false";
  const assistant = await checkRateLimit({ route: "program_hypotheses", kind: "assistant", key: "account:test" });
  const experiment = await checkRateLimit({ route: "program_experiment_queue", kind: "experiment_queue", key: "account:test" });
  assert.equal(assistant.allowed, true);
  assert.equal(assistant.limit, 20);
  assert.equal(experiment.allowed, true);
  assert.equal(experiment.limit, 10);
});
