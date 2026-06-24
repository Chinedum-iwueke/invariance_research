"use client";

import { useMemo, useState } from "react";
import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { C4ProgramDetail, MemoryAssessment } from "@/lib/server/research-c4/models";

type ActionState = { kind: "idle" | "working" | "error" | "success"; message?: string };

const pct = (value: number | undefined) => value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
const number = (value: number | undefined) => value === undefined ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const label = (value: string) => value.replaceAll("_", " ");

function tone(value: MemoryAssessment["assessment"]) {
  if (value === "supportive") return "border-chart-positive/40 bg-chart-positive/5 text-chart-positive";
  if (value === "block") return "border-chart-negative/40 bg-chart-negative/5 text-chart-negative";
  if (value === "caution") return "border-research-red/35 bg-research-red/5 text-research-red";
  return "border-border-subtle bg-surface-subtle text-text-neutral";
}

export function TradeMemoryPanel({
  programId,
  initialDetail,
  initialStrategyHash,
}: {
  programId: string;
  initialDetail: C4ProgramDetail;
  initialStrategyHash?: string;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [strategyHash, setStrategyHash] = useState(initialStrategyHash ?? "");
  const [featureText, setFeatureText] = useState('{"return_24h": 0.02, "volatility_24h": 0.04}');
  const latest = detail.assessments[0];
  const closedEpisodes = useMemo(() => detail.episodes.filter((episode) => episode.status === "closed"), [detail.episodes]);
  const stateCoverage = closedEpisodes.length ? detail.episodes.filter((episode) => episode.status === "closed" && episode.decision_state_snapshot_id).length / closedEpisodes.length : 0;

  async function refresh() {
    const response = await fetch(`/api/programs/${programId}/memory-assessments`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Memory refresh failed.");
    setDetail(payload.detail);
  }

  async function invoke(body: Record<string, unknown>, success: string) {
    setAction({ kind: "working" });
    try {
      const response = await fetch(`/api/programs/${programId}/memory-assessments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Memory action failed.");
      await refresh();
      setAction({ kind: "success", message: success });
    } catch (error) {
      setAction({ kind: "error", message: error instanceof Error ? error.message : "Memory action failed." });
    }
  }

  function assess() {
    let features: Record<string, unknown>;
    try {
      features = JSON.parse(featureText) as Record<string, unknown>;
    } catch {
      setAction({ kind: "error", message: "State features must be a valid JSON object." });
      return;
    }
    void invoke({ action: "assess", strategy_spec_hash: strategyHash, symbol, stage: "backtest", features }, "Decision-state assessment recorded.");
  }

  return (
    <div className="space-y-5">
      <div className="grid overflow-hidden rounded-md border border-border-subtle md:grid-cols-4">
        {[
          ["Closed episodes", String(closedEpisodes.length), "Outcomes available to retrieval"],
          ["State coverage", pct(stateCoverage), "Episodes with causal decision state"],
          ["Resolved assessments", String(detail.calibration.resolved), "Predictions linked to outcomes"],
          ["Calibration", detail.calibration.status.replaceAll("_", " "), detail.calibration.brier_score === undefined ? "Brier score unavailable" : `Brier ${detail.calibration.brier_score.toFixed(3)}`],
        ].map(([title, value, helper], index) => (
          <div key={title} className={`min-w-0 bg-surface-subtle p-4 ${index ? "border-t border-border-subtle md:border-l md:border-t-0" : ""}`}>
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{title}</p>
            <p className="mt-2 break-words text-xl font-medium capitalize text-text-institutional">{value}</p>
            <p className="mt-1 text-xs leading-5 text-text-neutral">{helper}</p>
          </div>
        ))}
      </div>

      {latest ? (
        <section className="overflow-hidden rounded-md border border-border-subtle" aria-label="Latest memory assessment">
          <div className="flex flex-wrap items-start justify-between gap-4 bg-surface-subtle px-5 py-4">
            <div>
              <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Latest decision-state assessment</p>
              <h3 className="mt-2 text-lg font-medium text-text-institutional">Comparable outcome evidence</h3>
            </div>
            <span className={`rounded-sm border px-2.5 py-1 text-xs font-medium uppercase ${tone(latest.assessment)}`}>{label(latest.assessment)}</span>
          </div>
          <div className="grid border-t border-border-subtle bg-surface-white sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Support", String(latest.support_count)],
              ["Same strategy", String(latest.strategy_support_count)],
              ["Cross strategy", String(latest.cross_strategy_support_count)],
              ["Positive rate", pct(latest.empirical_positive_rate)],
              ["State similarity", pct(latest.state_similarity_score)],
              ["Drift ratio", number(latest.drift_ratio)],
            ].map(([title, value], index) => <div key={title} className={`p-4 ${index ? "border-t border-border-subtle sm:border-l sm:[&:nth-child(2)]:border-t-0 xl:border-t-0" : ""}`}><p className="text-[11px] text-text-neutral">{title}</p><p className="mt-1 text-base font-medium text-text-institutional">{value}</p></div>)}
          </div>
          <div className="grid gap-4 border-t border-border-subtle px-5 py-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-text-neutral">Evidence boundary</p>
              <p className="mt-2 text-sm leading-6 text-text-institutional">{latest.reason_codes.map(label).join("; ")}.</p>
              {latest.uncertainty_interval.length === 2 ? <p className="mt-1 text-xs leading-5 text-text-neutral">Positive-outcome interval: {pct(latest.uncertainty_interval[0])} to {pct(latest.uncertainty_interval[1])}.</p> : null}
            </div>
            <div className="flex gap-3 rounded-sm border border-border-subtle bg-surface-subtle p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-research-red" aria-hidden="true" />
              <p className="text-xs leading-5 text-text-neutral">Advisory only. Memory can reduce or block proposed risk; it never authorizes a trade or increases risk.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex gap-3 rounded-md border border-border-subtle bg-surface-subtle p-4">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-research-red" aria-hidden="true" />
          <p className="text-sm leading-6 text-text-neutral">No decision-state assessment exists yet. Import outcomes with causal state fields, then assess a current state. Missing state remains explicit rather than inferred after the fact.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="border-t border-border-subtle pt-4">
          <div className="flex items-center gap-2"><Database className="h-4 w-4 text-research-red" aria-hidden="true" /><h3 className="text-sm font-medium text-text-institutional">Build governed memory</h3></div>
          <p className="mt-2 text-xs leading-5 text-text-neutral">Backtest imports accept trade outcomes and only retain state fields captured at the decision timestamp. Confirmed notes and verified Pine observations are indexed separately; they never masquerade as trade outcomes.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={action.kind === "working"} onClick={() => void invoke({ action: "sync_backtest" }, "Backtest trade memory synchronized.")}><RefreshCw className="mr-2 h-3.5 w-3.5" />Sync trade episodes</Button>
            <Button size="sm" variant="secondary" disabled={action.kind === "working"} onClick={() => void invoke({ action: "sync_governed" }, "Confirmed research memory synchronized.")}><RefreshCw className="mr-2 h-3.5 w-3.5" />Sync confirmed reasoning</Button>
          </div>
          <p className="mt-3 text-xs text-text-neutral">{detail.canonical_entries.length} governed reasoning entries · {detail.snapshots.length} causal state snapshots</p>
        </section>

        <details className="border-t border-border-subtle pt-4">
          <summary className="cursor-pointer text-sm font-medium text-text-institutional">Assess a recorded decision state</summary>
          <p className="mt-2 text-xs leading-5 text-text-neutral">Use normalized, decision-time features only. This advanced input is fail-closed and stores feature timestamps with the assessment.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-text-neutral">Symbol<input value={symbol} onChange={(event) => setSymbol(event.target.value)} className="mt-1 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-institutional" /></label>
            <label className="text-xs text-text-neutral">Strategy spec hash<input value={strategyHash} onChange={(event) => setStrategyHash(event.target.value)} className="mt-1 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-institutional" /></label>
          </div>
          <label className="mt-3 block text-xs text-text-neutral">Decision-time features<textarea value={featureText} onChange={(event) => setFeatureText(event.target.value)} rows={4} className="mt-1 w-full resize-y rounded-sm border border-border-subtle bg-surface-white px-3 py-2 font-mono text-xs leading-5 text-text-institutional" /></label>
          <Button className="mt-3" size="sm" disabled={action.kind === "working" || !strategyHash.trim() || !symbol.trim()} onClick={assess}>Run advisory assessment</Button>
        </details>
      </div>

      {action.message ? <p role="status" className={`text-xs ${action.kind === "error" ? "text-chart-negative" : "text-text-neutral"}`}>{action.message}</p> : null}
    </div>
  );
}
