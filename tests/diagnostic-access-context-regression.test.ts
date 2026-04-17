import assert from "node:assert/strict";
import test from "node:test";
import { buildTruthContext } from "../src/lib/app/context-truth.ts";
import { resolveDiagnosticAccess } from "../src/lib/server/entitlements/policy.ts";

test("trade-only artifacts still allow ruin diagnostics when plan is entitled", () => {
  const access = resolveDiagnosticAccess({
    account_id: "acct-test",
    diagnostic: "ruin",
    parsed_artifact: {
      richness: "trade_only",
    } as never,
    is_admin: true,
  });

  assert.equal(access.allowed, true);
  assert.equal(access.reason, "enabled");
});

test("selected benchmark with no overlap does not emit stale benchmark upload recommendation", () => {
  const context = buildTruthContext(
    {
      engine_payload: {
        diagnostics: {
          overview: {
            benchmark_comparison: {
              reason: "no_benchmark_overlap",
              metadata: { benchmark_id: "SPY" },
              summary_metrics: { benchmark_selected: "SPY" },
            },
          },
        },
      },
      diagnostic_statuses: {
        regimes: { status: "available" },
        stability: { status: "available" },
        execution: { status: "available" },
      },
      diagnostics: {
        overview: { recommendations: [] },
      },
      report: {
        methodology_assumptions: [],
        limitations: [],
        recommendations: [],
      },
    } as never,
    "overview",
  );

  assert.equal(
    context.recommendations.some((line) => /upload benchmark-compatible data or configure a benchmark explicitly/i.test(line)),
    false,
  );
  assert.equal(
    context.recommendations.some((line) => /overlap with strategy timestamps was insufficient/i.test(line)),
    true,
  );
});

test("truth context tolerates structured recommendation objects", () => {
  const context = buildTruthContext(
    {
      engine_payload: {
        diagnostics: {
          overview: {
            benchmark_comparison: {
              reason: "available",
            },
          },
        },
      },
      diagnostic_statuses: {
        regimes: { status: "available" },
        stability: { status: "available" },
        execution: { status: "available" },
      },
      diagnostics: {
        ruin: {
          recommendations: [
            { message: "Keep risk sizing stable between sessions." },
          ],
        },
      },
      report: {
        methodology_assumptions: [],
        limitations: [],
        recommendations: [],
      },
    } as never,
    "ruin",
  );

  assert.equal(
    context.recommendations.includes("Keep risk sizing stable between sessions."),
    true,
  );
});
