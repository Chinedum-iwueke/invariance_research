"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  HypothesisVersionRecord,
  ExperimentJobRecord,
  ExperimentPlanRecord,
  ResearchBriefRecord,
  StrategySpecRecord,
} from "@/lib/server/research-programs/models";

type Props = {
  programId: string;
  briefs: ResearchBriefRecord[];
  hypothesisVersions: HypothesisVersionRecord[];
  strategySpecs: StrategySpecRecord[];
  experimentPlans: ExperimentPlanRecord[];
  experimentJobs: ExperimentJobRecord[];
};

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls = tone === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-border-subtle bg-surface-white text-text-neutral";
  return <span className={`rounded-sm border px-2 py-1 text-xs ${cls}`}>{children}</span>;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "request_failed");
  return payload;
}

export function SpecApprovalPanel({ programId, briefs, hypothesisVersions, strategySpecs, experimentPlans, experimentJobs }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hypothesisJson, setHypothesisJson] = useState("");
  const [strategyJson, setStrategyJson] = useState("");
  const latestBrief = briefs[0];
  const latestHypothesis = hypothesisVersions[0];
  const previousHypothesis = hypothesisVersions[1];
  const approvedHypotheses = useMemo(
    () => hypothesisVersions.filter((item) => item.status === "approved_for_strategy_generation" && item.validation_errors.length === 0),
    [hypothesisVersions],
  );
  const latestStrategy = strategySpecs[0];
  const previousStrategy = strategySpecs[1];
  const approvedStrategies = useMemo(
    () => strategySpecs.filter((item) => item.status === "approved_for_execution" && item.validation_errors.length === 0),
    [strategySpecs],
  );
  const latestPlan = experimentPlans[0];

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  function parseEditorJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error("Invalid JSON. Fix the editor contents and try again.");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">B3</p>
              <h3 className="mt-1 font-medium text-text-institutional">Hypothesis spec</h3>
            </div>
            {latestHypothesis ? <Pill tone={latestHypothesis.validation_errors.length ? "warn" : latestHypothesis.status === "approved_for_strategy_generation" ? "good" : "neutral"}>{latestHypothesis.status.replace(/_/g, " ")}</Pill> : <Pill>not drafted</Pill>}
          </div>
          <p className="mt-3 text-sm leading-6 text-text-neutral">Draft a versioned test protocol with thesis, mechanism, observable fields, invalidation criteria, required evidence, cost assumptions, and safe parameter ranges.</p>
          {latestBrief ? (
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={Boolean(busy)}
              onClick={() => act("hypothesis", async () => {
                await postJson(`/api/programs/${programId}/hypotheses`, { action: "generate_from_brief", brief_id: latestBrief.brief_id });
              })}
            >
              {busy === "hypothesis" ? "Drafting..." : "Draft Hypothesis Spec"}
            </Button>
          ) : (
            <p className="mt-4 text-xs text-text-neutral">Accept a research brief before drafting a hypothesis.</p>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Approval gate</p>
              <h3 className="mt-1 font-medium text-text-institutional">User approval</h3>
            </div>
            <Pill>fail closed</Pill>
          </div>
          <p className="mt-3 text-sm leading-6 text-text-neutral">Invalid hypothesis specs cannot move forward. Approved versions become eligible for strategy-spec generation.</p>
          {latestHypothesis ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              disabled={Boolean(busy) || latestHypothesis.validation_errors.length > 0 || latestHypothesis.status === "approved_for_strategy_generation"}
              onClick={() => act("approve_hypothesis", async () => {
                await postJson(`/api/programs/${programId}/hypotheses`, { action: "approve", hypothesis_version_id: latestHypothesis.hypothesis_version_id });
              })}
            >
              {busy === "approve_hypothesis" ? "Approving..." : latestHypothesis.status === "approved_for_strategy_generation" ? "Hypothesis Approved" : "Approve Hypothesis"}
            </Button>
          ) : null}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">B4</p>
              <h3 className="mt-1 font-medium text-text-institutional">Strategy spec</h3>
            </div>
            {latestStrategy ? <Pill tone={latestStrategy.validation_errors.length ? "warn" : latestStrategy.status === "approved_for_execution" ? "good" : "neutral"}>{latestStrategy.status.replace(/_/g, " ")}</Pill> : <Pill>not proposed</Pill>}
          </div>
          <p className="mt-3 text-sm leading-6 text-text-neutral">Generate a strategy contract with signal functions, bounded parameters, cost/slippage/risk models, and execution semantics.</p>
          {approvedHypotheses[0] ? (
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={Boolean(busy)}
              onClick={() => act("strategy", async () => {
                await postJson(`/api/programs/${programId}/strategy-specs`, { action: "generate_from_hypothesis", hypothesis_version_id: approvedHypotheses[0].hypothesis_version_id });
              })}
            >
              {busy === "strategy" ? "Generating..." : "Generate Strategy Spec"}
            </Button>
          ) : (
            <p className="mt-4 text-xs text-text-neutral">Approve a valid hypothesis before generating a strategy spec.</p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">B5</p>
            <h3 className="mt-1 font-medium text-text-institutional">Experiment plan and queue</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-neutral">Turn an approved strategy spec into baseline, cost, slippage, parameter, holdout, benchmark, and state-split falsification jobs. Execution starts in B6; this phase makes the queue durable and governed.</p>
          </div>
          {latestPlan ? <Pill tone={latestPlan.status === "queued" ? "good" : "neutral"}>{latestPlan.status}</Pill> : <Pill>not planned</Pill>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {approvedStrategies[0] ? (
            <Button
              type="button"
              size="sm"
              disabled={Boolean(busy)}
              onClick={() => act("plan", async () => {
                await postJson(`/api/programs/${programId}/experiment-plans`, { action: "generate_from_strategy", strategy_spec_record_id: approvedStrategies[0].strategy_spec_record_id });
              })}
            >
              {busy === "plan" ? "Planning..." : "Generate Experiment Plan"}
            </Button>
          ) : (
            <p className="text-xs text-text-neutral">Approve a valid strategy spec before generating an experiment plan.</p>
          )}
          {latestPlan ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={Boolean(busy) || latestPlan.validation_errors.length > 0 || latestPlan.status !== "draft"}
                onClick={() => act("approve_plan", async () => {
                  await postJson(`/api/programs/${programId}/experiment-plans`, { action: "approve", experiment_plan_id: latestPlan.experiment_plan_id });
                })}
              >
                {busy === "approve_plan" ? "Approving..." : latestPlan.status === "approved" || latestPlan.status === "queued" ? "Plan Approved" : "Approve Plan"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={Boolean(busy) || latestPlan.validation_errors.length > 0 || latestPlan.status !== "approved"}
                onClick={() => act("queue_plan", async () => {
                  await postJson(`/api/programs/${programId}/experiment-plans`, { action: "queue", experiment_plan_id: latestPlan.experiment_plan_id });
                })}
              >
                {busy === "queue_plan" ? "Queueing..." : "Queue Experiments"}
              </Button>
            </>
          ) : null}
        </div>
        {latestPlan ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {latestPlan.plan.items.map((item) => (
              <div key={item.item_id} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-text-institutional">{item.title}</p>
                  <Pill>{item.experiment_type.replace(/_/g, " ")}</Pill>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-neutral">{item.falsification_question}</p>
                <p className="mt-3 text-xs text-text-neutral">{item.runtime_budget.max_variants} variant(s) · {item.runtime_budget.max_minutes} min budget · priority {item.priority}</p>
              </div>
            ))}
          </div>
        ) : null}
        {experimentJobs.length > 0 ? (
          <div className="mt-5 space-y-2">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Queued jobs</p>
            {experimentJobs.slice(0, 8).map((job) => (
              <div key={job.experiment_job_id} className="grid gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={job.status === "queued" ? "good" : job.status === "failed" ? "warn" : "neutral"}>{job.status}</Pill>
                    <p className="text-sm font-medium text-text-institutional">{job.current_step}</p>
                  </div>
                  <p className="mt-1 text-xs text-text-neutral">priority {job.priority} · retries {job.retry_count}/{job.max_attempts} · {job.created_at.slice(0, 10)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy) || job.status !== "queued"} onClick={() => act(`pause_${job.experiment_job_id}`, async () => postJson(`/api/experiment-jobs/${job.experiment_job_id}`, { action: "pause" }))}>Pause</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy) || ["completed", "canceled"].includes(job.status)} onClick={() => act(`cancel_${job.experiment_job_id}`, async () => postJson(`/api/experiment-jobs/${job.experiment_job_id}`, { action: "cancel" }))}>Cancel</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy) || !["failed", "paused", "canceled"].includes(job.status)} onClick={() => act(`retry_${job.experiment_job_id}`, async () => postJson(`/api/experiment-jobs/${job.experiment_job_id}`, { action: "retry" }))}>Retry</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {latestHypothesis ? (
        <div className="rounded-md border border-border-subtle bg-surface-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-text-institutional">Latest hypothesis v{latestHypothesis.version}</h3>
            <Pill tone={latestHypothesis.validation_errors.length ? "warn" : "good"}>{latestHypothesis.validation_errors.length ? "validation issues" : "schema valid"}</Pill>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Invalidation criteria</p>
              <div className="mt-2 space-y-2">
                {latestHypothesis.spec.invalidation_criteria.map((item) => (
                  <div key={item} className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-neutral">{item}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Required evidence</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {latestHypothesis.spec.required_datasets.map((item) => <Pill key={item}>{item}</Pill>)}
              </div>
              {latestHypothesis.validation_errors.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {latestHypothesis.validation_errors.map((item) => <div key={item} className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{item}</div>)}
                </div>
              ) : null}
            </div>
          </div>
          <details className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3">
            <summary
              className="cursor-pointer text-sm font-medium text-text-institutional"
              onClick={() => {
                if (!hypothesisJson) setHypothesisJson(JSON.stringify(latestHypothesis.spec, null, 2));
              }}
            >
              Edit hypothesis JSON as new version
            </summary>
            <textarea
              value={hypothesisJson || JSON.stringify(latestHypothesis.spec, null, 2)}
              onChange={(event) => setHypothesisJson(event.target.value)}
              className="mt-3 min-h-80 w-full rounded-sm border border-border-subtle bg-surface-white p-3 font-mono text-xs text-text-neutral outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              className="mt-3"
              disabled={Boolean(busy)}
              onClick={() => act("save_hypothesis", async () => {
                await postJson(`/api/programs/${programId}/hypotheses`, {
                  action: "save_manual",
                  hypothesis_version_id: latestHypothesis.hypothesis_version_id,
                  spec: parseEditorJson(hypothesisJson || JSON.stringify(latestHypothesis.spec, null, 2)),
                });
              })}
            >
              {busy === "save_hypothesis" ? "Saving..." : "Save New Hypothesis Version"}
            </Button>
          </details>
          {previousHypothesis ? (
            <details className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-institutional">Compare with hypothesis v{previousHypothesis.version}</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <pre className="max-h-80 overflow-auto rounded-sm bg-surface-white p-3 text-xs text-text-neutral">{JSON.stringify(previousHypothesis.spec, null, 2)}</pre>
                <pre className="max-h-80 overflow-auto rounded-sm bg-surface-white p-3 text-xs text-text-neutral">{JSON.stringify(latestHypothesis.spec, null, 2)}</pre>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {latestStrategy ? (
        <div className="rounded-md border border-border-subtle bg-surface-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-text-institutional">Latest strategy spec v{latestStrategy.version}</h3>
              <p className="mt-1 text-xs text-text-neutral">{latestStrategy.spec.strategy_family.replace(/_/g, " ")} · {latestStrategy.spec.timeframe} · {latestStrategy.spec.signals.length} signal contract(s)</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={Boolean(busy) || latestStrategy.validation_errors.length > 0 || latestStrategy.status === "approved_for_execution"}
              onClick={() => act("approve_strategy", async () => {
                await postJson(`/api/programs/${programId}/strategy-specs`, { action: "approve", strategy_spec_record_id: latestStrategy.strategy_spec_record_id });
              })}
            >
              {busy === "approve_strategy" ? "Approving..." : latestStrategy.status === "approved_for_execution" ? "Strategy Approved" : "Approve Strategy Spec"}
            </Button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Assistant assumed</p>
              <div className="mt-2 space-y-2">
                {latestStrategy.spec.assistant_assumptions.map((item) => <div key={item} className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-text-neutral">{item}</div>)}
              </div>
            </div>
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Execution guardrails</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Pill tone="good">lookahead false</Pill>
                <Pill tone="good">interpolation false</Pill>
                <Pill>closed bars only</Pill>
                <Pill>bounded parameters</Pill>
              </div>
              {latestStrategy.validation_errors.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {latestStrategy.validation_errors.map((item) => <div key={item} className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{item}</div>)}
                </div>
              ) : null}
            </div>
          </div>
          <details className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3">
            <summary
              className="cursor-pointer text-sm font-medium text-text-institutional"
              onClick={() => {
                if (!strategyJson) setStrategyJson(JSON.stringify(latestStrategy.spec, null, 2));
              }}
            >
              Edit strategy JSON as new version
            </summary>
            <textarea
              value={strategyJson || JSON.stringify(latestStrategy.spec, null, 2)}
              onChange={(event) => setStrategyJson(event.target.value)}
              className="mt-3 min-h-96 w-full rounded-sm border border-border-subtle bg-surface-white p-3 font-mono text-xs text-text-neutral outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              className="mt-3"
              disabled={Boolean(busy)}
              onClick={() => act("save_strategy", async () => {
                await postJson(`/api/programs/${programId}/strategy-specs`, {
                  action: "save_manual",
                  strategy_spec_record_id: latestStrategy.strategy_spec_record_id,
                  spec: parseEditorJson(strategyJson || JSON.stringify(latestStrategy.spec, null, 2)),
                });
              })}
            >
              {busy === "save_strategy" ? "Saving..." : "Save New Strategy Version"}
            </Button>
          </details>
          {previousStrategy ? (
            <details className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-institutional">Compare with strategy spec v{previousStrategy.version}</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <pre className="max-h-80 overflow-auto rounded-sm bg-surface-white p-3 text-xs text-text-neutral">{JSON.stringify(previousStrategy.spec, null, 2)}</pre>
                <pre className="max-h-80 overflow-auto rounded-sm bg-surface-white p-3 text-xs text-text-neutral">{JSON.stringify(latestStrategy.spec, null, 2)}</pre>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
