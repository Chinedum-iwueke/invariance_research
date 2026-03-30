import React from "react";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

export type BenchmarkSelectionValue = {
  mode: "auto" | "none" | "manual";
  requested_id: BenchmarkId | null;
};

type BenchmarkSelectorProps = {
  value: BenchmarkSelectionValue;
  onChange: (value: BenchmarkSelectionValue) => void;
};

const MANUAL_BENCHMARKS: BenchmarkId[] = ["BTC", "SPY", "XAUUSD", "DXY"];

export function BenchmarkSelector({ value, onChange }: BenchmarkSelectorProps) {
  const selectorValue = value.mode === "manual" ? value.requested_id ?? "BTC" : value.mode;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-institutional" htmlFor="benchmark-selector">Benchmark selection</label>
      <select
        id="benchmark-selector"
        data-testid="benchmark-selector"
        aria-label="Benchmark selection"
        className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
        value={selectorValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "auto" || next === "none") {
            onChange({ mode: next, requested_id: null });
            return;
          }
          onChange({ mode: "manual", requested_id: next as BenchmarkId });
        }}
      >
        <option value="auto">Auto</option>
        <option value="none">None</option>
        {MANUAL_BENCHMARKS.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <p className="text-xs text-text-neutral">Auto uses detected asset class. None disables benchmark comparison.</p>
    </div>
  );
}
