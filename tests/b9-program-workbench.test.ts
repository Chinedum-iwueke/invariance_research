import assert from "node:assert/strict";
import test from "node:test";
import type { ProgramDetail } from "../src/lib/server/research-programs/models";
import { buildProgramWorkbenchSummary } from "../src/lib/server/research-programs/workbench";

const now = "2026-06-13T00:00:00.000Z";

function detail(overrides: Partial<ProgramDetail> = {}): ProgramDetail {
  return {
    program: {
      program_id: "program-1",
      account_id: "account-1",
      owner_user_id: "user-1",
      title: "Program",
      thesis: "Test thesis",
      status: "active",
      next_action: "Run the next falsification test.",
      created_at: now,
      updated_at: now,
      attached_analysis_count: 0,
      completed_analysis_count: 0,
      failed_analysis_count: 0,
      active_hypothesis_count: 0,
      promoted_count: 0,
    },
    events: [],
    notes: [],
    artifacts: [],
    analyses: [],
    clarification_sessions: [],
    research_briefs: [],
    hypotheses: [],
    hypothesis_versions: [],
    strategy_specs: [],
    experiment_plans: [],
    experiment_plan_items: [],
    experiment_jobs: [],
    experiment_job_events: [],
    reports: [],
    memory: {
      items: [],
      findings: [],
      recommendations: [],
      similar_runs: [],
    },
    ...overrides,
  };
}

test("B9 workbench summary starts conservative without evidence", () => {
  const summary = buildProgramWorkbenchSummary(detail());
  assert.equal(summary.active_hypotheses, 0);
  assert.equal(summary.completed_experiments, 0);
  assert.equal(summary.command_states.can_create_hypothesis, false);
  assert.equal(summary.command_states.can_queue_next_experiment, false);
  assert.equal(summary.command_states.can_generate_report, false);
});

test("B9 workbench summary exposes program command states from real program objects", () => {
  const summary = buildProgramWorkbenchSummary(detail({
    analyses: [{
      analysis_id: "analysis-1",
      strategy_name: "Audit import",
      status: "completed",
      asset: "BTC",
      timeframe: "1h",
      trade_count: 100,
      created_at: now,
      robustness_score: "60",
    }],
    research_briefs: [{
      brief_id: "brief-1",
      program_id: "program-1",
      account_id: "account-1",
      version: 1,
      status: "accepted",
      brief: {
        schema_version: "research_brief_v1",
        program_id: "program-1",
        title: "Brief",
        thesis: "Test thesis",
        market_intuition: "Trend persists after dislocation.",
        missing_assumptions: [],
        clarification_answers: {},
        readiness: "ready_for_hypothesis_draft",
        created_at: now,
      },
      created_by_user_id: "user-1",
      created_at: now,
      accepted_at: now,
    }],
    hypothesis_versions: [{
      hypothesis_version_id: "hypothesis-version-1",
      hypothesis_id: "hypothesis-1",
      program_id: "program-1",
      account_id: "account-1",
      version: 1,
      status: "approved_for_strategy_generation",
      spec: {
        schema_version: "hypothesis_spec_v1",
        hypothesis_id: "hypothesis-1",
        title: "Hypothesis",
        thesis: "Test thesis",
        market_mechanism: "Momentum continuation",
        observable_features: ["return_24h"],
        entry_condition_intent: "Enter on breakout",
        exit_condition_intent: "Exit on reversal",
        invalidation_criteria: ["No persistence"],
        required_datasets: ["ohlcv"],
        cost_model_assumptions: "Explicit bps",
        benchmark_or_null: "cash",
        expected_failure_modes: ["cost drag"],
        safe_parameter_ranges: {},
        out_of_sample_plan: "holdout",
        execution_semantics: {},
        generated_by: "deterministic_assistant",
        generated_at: now,
      },
      validation_errors: [],
      created_by_user_id: "user-1",
      created_at: now,
      approved_at: now,
      approved_by_user_id: "user-1",
    }],
    strategy_specs: [{
      strategy_spec_record_id: "strategy-1",
      program_id: "program-1",
      account_id: "account-1",
      hypothesis_version_id: "hypothesis-version-1",
      version: 1,
      status: "approved_for_execution",
      spec: {
        schema_version: "strategy_spec_v1",
        strategy_spec_id: "strategy-spec-1",
        hypothesis_id: "hypothesis-1",
        hypothesis_version_id: "hypothesis-version-1",
        strategy_family: "trend_continuation",
        universe: ["BTCUSDT"],
        timeframe: "1h",
        required_datasets: ["ohlcv"],
        signals: [],
        parameters: {},
        cost_model: {},
        slippage_model: {},
        risk_model: {},
        execution_semantics: {},
        compiler: {},
        assistant_assumptions: [],
        user_approval_required: true,
        generated_by: "deterministic_assistant",
        generated_at: now,
      },
      validation_errors: [],
      created_by_user_id: "user-1",
      created_at: now,
      approved_at: now,
      approved_by_user_id: "user-1",
    }],
    experiment_plans: [{
      experiment_plan_id: "plan-1",
      program_id: "program-1",
      account_id: "account-1",
      strategy_spec_record_id: "strategy-1",
      hypothesis_version_id: "hypothesis-version-1",
      status: "approved",
      plan: {
        schema_version: "experiment_plan_v1",
        plan_id: "plan-1",
        strategy_spec_id: "strategy-spec-1",
        hypothesis_id: "hypothesis-1",
        plan_title: "Plan",
        status: "approved",
        items: [],
        limits: { max_concurrent: 1, max_queued_items: 1, estimated_compute_units: 1 },
        approval_required: true,
      },
      validation_errors: [],
      created_by_user_id: "user-1",
      created_at: now,
      approved_at: now,
      approved_by_user_id: "user-1",
    }],
    experiment_jobs: [
      {
        experiment_job_id: "job-1",
        experiment_plan_item_id: "item-1",
        experiment_plan_id: "plan-1",
        program_id: "program-1",
        account_id: "account-1",
        status: "completed",
        priority: 1,
        progress_pct: 100,
        current_step: "completed",
        retry_count: 0,
        max_attempts: 3,
        available_at: now,
        created_at: now,
        updated_at: now,
        started_at: now,
        finished_at: now,
      },
      {
        experiment_job_id: "job-2",
        experiment_plan_item_id: "item-2",
        experiment_plan_id: "plan-1",
        program_id: "program-1",
        account_id: "account-1",
        status: "failed",
        priority: 1,
        progress_pct: 50,
        current_step: "failed",
        retry_count: 1,
        max_attempts: 3,
        available_at: now,
        last_error: "runner failed",
        created_at: now,
        updated_at: now,
      },
    ],
    experiment_job_events: [{
      experiment_job_event_id: "event-1",
      experiment_job_id: "job-1",
      experiment_plan_id: "plan-1",
      program_id: "program-1",
      account_id: "account-1",
      event_type: "completed",
      message: "Completed",
      payload: {
        card_summary: {
          card_count: 7,
          verdict: "promising_but_under_supported",
          confidence: "medium",
          decision_grade: false,
          recommended_action: "run_holdout",
        },
      },
      created_at: now,
    }],
    memory: {
      items: [{
        memory_item_id: "memory-1",
        account_id: "account-1",
        program_id: "program-1",
        memory_type: "verdict",
        title: "Verdict",
        summary: "Promising but under-supported",
        status: "active",
        confidence: 0.7,
        source: {},
        tags: ["verdict"],
        created_at: now,
        updated_at: now,
      }],
      findings: [{
        finding_id: "finding-1",
        account_id: "account-1",
        program_id: "program-1",
        finding_type: "failure",
        headline: "Cost drag",
        detail: "Edge dies under costs.",
        severity: "critical",
        evidence: {},
        created_at: now,
      }],
      recommendations: [{
        recommendation_id: "rec-1",
        account_id: "account-1",
        program_id: "program-1",
        recommendation_type: "next_experiment",
        recommendation: "Run holdout.",
        status: "accepted",
        confidence: 0.6,
        evidence: {},
        created_at: now,
        updated_at: now,
      }],
      similar_runs: [{
        similar_run_index_id: "similar-1",
        account_id: "account-1",
        program_id: "program-1",
        signature: "cost_drag:medium",
        features: {},
        created_at: now,
      }],
    },
  }));

  assert.equal(summary.active_hypotheses, 1);
  assert.equal(summary.approved_hypotheses, 1);
  assert.equal(summary.approved_strategy_specs, 1);
  assert.equal(summary.completed_experiments, 1);
  assert.equal(summary.failed_experiments, 1);
  assert.equal(summary.latest_verdict?.verdict, "promising_but_under_supported");
  assert.equal(summary.memory_items, 1);
  assert.equal(summary.findings, 1);
  assert.equal(summary.similar_signatures, 1);
  assert.equal(summary.command_states.can_create_hypothesis, true);
  assert.equal(summary.command_states.can_queue_next_experiment, true);
  assert.equal(summary.command_states.can_explain_failure, true);
  assert.equal(summary.command_states.can_find_similar_runs, true);
  assert.equal(summary.command_states.can_generate_report, true);
  assert.equal(summary.command_states.can_request_research_desk, true);
});
