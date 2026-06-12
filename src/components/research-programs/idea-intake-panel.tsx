"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ProgramClarificationSession, ResearchBriefRecord } from "@/lib/server/research-programs/models";

type Intake = {
  market_intuition: string;
  asset_universe: string;
  timeframe: string;
  holding_period: string;
  entry_idea: string;
  exit_idea: string;
  risk_assumption: string;
  cost_slippage_assumption: string;
  data_source: string;
  disproof_condition: string;
};

const emptyIntake: Intake = {
  market_intuition: "",
  asset_universe: "",
  timeframe: "",
  holding_period: "",
  entry_idea: "",
  exit_idea: "",
  risk_assumption: "",
  cost_slippage_assumption: "",
  data_source: "",
  disproof_condition: "",
};

const fieldLabels: Array<{ key: keyof Intake; label: string; placeholder: string; type?: "textarea" }> = [
  { key: "market_intuition", label: "Market intuition", placeholder: "Example: BTC tends to continue after high-volume London breakout failures reverse during New York.", type: "textarea" },
  { key: "asset_universe", label: "Asset universe", placeholder: "BTCUSDT, ETHUSDT, EURUSD, NQ..." },
  { key: "timeframe", label: "Timeframe", placeholder: "5m, 15m, 1h, daily..." },
  { key: "holding_period", label: "Holding period", placeholder: "Intraday, 4-12 bars, 2-5 days..." },
  { key: "entry_idea", label: "Entry idea", placeholder: "Observable condition that opens a trade" },
  { key: "exit_idea", label: "Exit idea", placeholder: "Target, stop, invalidation, time exit..." },
  { key: "risk_assumption", label: "Risk assumption", placeholder: "Fixed fractional, 1R stop, max daily loss..." },
  { key: "cost_slippage_assumption", label: "Cost/slippage assumption", placeholder: "Fees, spread, slippage, venue assumptions..." },
  { key: "data_source", label: "Data source", placeholder: "Exchange, broker, OHLCV vendor, export source..." },
  { key: "disproof_condition", label: "What would disprove this?", placeholder: "Example: no edge after fees, fails holdout, dies above 5 bps..." },
];

export function IdeaIntakePanel({ programId, latestBrief }: { programId: string; latestBrief?: ResearchBriefRecord }) {
  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [session, setSession] = useState<ProgramClarificationSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const missingCounts = useMemo(() => {
    const items = session?.missing_assumptions ?? latestBrief?.brief.missing_assumptions ?? [];
    return {
      blocking: items.filter((item) => item.severity === "blocking").length,
      important: items.filter((item) => item.severity === "important").length,
      optional: items.filter((item) => item.severity === "optional").length,
    };
  }, [latestBrief, session]);

  async function createClarification() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/programs/${programId}/clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", intake }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "clarification_failed");
      setSession(payload.clarification);
      setAnswers({});
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "clarification_failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptBrief() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/programs/${programId}/clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", session_id: session.session_id, answers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "brief_acceptance_failed");
      setSession(null);
      setAnswers({});
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "brief_acceptance_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {latestBrief ? (
        <div className="rounded-md border border-brand/25 bg-brand/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-text-institutional">Accepted research brief v{latestBrief.version}</p>
            <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-xs text-text-neutral">{latestBrief.brief.readiness.replace(/_/g, " ")}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-neutral">{latestBrief.brief.market_intuition}</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Blocking", missingCounts.blocking],
          ["Important", missingCounts.important],
          ["Optional", missingCounts.optional],
        ].map(([label, count]) => (
          <div key={label} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">{label}</p>
            <p className="mt-1 text-xl font-semibold text-text-institutional">{count}</p>
          </div>
        ))}
      </div>

      {!session ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {fieldLabels.map((field) => (
              <label key={field.key} className={field.type === "textarea" ? "block text-sm font-medium text-text-institutional md:col-span-2" : "block text-sm font-medium text-text-institutional"}>
                {field.label}
                {field.type === "textarea" ? (
                  <textarea
                    value={intake[field.key]}
                    onChange={(event) => setIntake((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={4}
                    className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                ) : (
                  <input
                    value={intake[field.key]}
                    onChange={(event) => setIntake((current) => ({ ...current, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                )}
              </label>
            ))}
          </div>
          {error ? <p className="text-sm text-chart-negative">{error}</p> : null}
          <Button type="button" disabled={busy || intake.market_intuition.trim().length < 10} onClick={createClarification}>
            {busy ? "Clarifying..." : "Clarify Idea"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
            <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Assistant source</p>
            <p className="mt-1 text-sm text-text-institutional">{session.provider}{session.model ? ` · ${session.model}` : ""}</p>
            {session.error_summary ? <p className="mt-2 text-xs text-text-neutral">Fallback reason: {session.error_summary}</p> : null}
          </div>

          {session.missing_assumptions.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {session.missing_assumptions.map((assumption) => (
                <div key={assumption.assumption_id} className="rounded-md border border-border-subtle bg-surface-white p-4">
                  <span className="rounded-sm border border-border-subtle px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-neutral">{assumption.severity}</span>
                  <p className="mt-3 font-medium text-text-institutional">{assumption.label}</p>
                  <p className="mt-2 text-sm leading-6 text-text-neutral">{assumption.why_it_matters}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {session.assistant_questions.map((question) => (
              <label key={question.question_id} className="block rounded-md border border-border-subtle bg-surface-subtle p-4 text-sm font-medium text-text-institutional">
                {question.question}
                <span className="mt-1 block text-xs font-normal leading-5 text-text-neutral">{question.why_it_matters}</span>
                <textarea
                  value={answers[question.question_id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.question_id]: event.target.value }))}
                  rows={2}
                  className="mt-3 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </label>
            ))}
          </div>
          {error ? <p className="text-sm text-chart-negative">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={acceptBrief}>
              {busy ? "Accepting..." : "Accept Research Brief"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setSession(null)}>
              Revise Intake
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
