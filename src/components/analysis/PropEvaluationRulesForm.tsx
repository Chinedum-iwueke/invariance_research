"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

function asInputPercent(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value <= 1 ? value * 100 : value)
    : fallback;
}

function parsePositive(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePercent(value: string): number | undefined {
  const parsed = parsePositive(value);
  if (parsed === undefined) return undefined;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function PropEvaluationRulesForm({
  analysisId,
  initialRules,
}: {
  analysisId: string;
  initialRules: Record<string, unknown>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [label, setLabel] = useState(String(initialRules.label ?? initialRules.firm_label ?? "Prop evaluation"));
  const [accountSize, setAccountSize] = useState(String(initialRules.account_size ?? "100000"));
  const [profitTarget, setProfitTarget] = useState(asInputPercent(initialRules.profit_target_pct, "8"));
  const [totalDrawdown, setTotalDrawdown] = useState(asInputPercent(initialRules.max_total_drawdown_pct, "10"));
  const [dailyLoss, setDailyLoss] = useState(asInputPercent(initialRules.max_daily_loss_pct, "5"));
  const [minimumDays, setMinimumDays] = useState(String(initialRules.minimum_trading_days ?? "5"));
  const [maximumDays, setMaximumDays] = useState(String(initialRules.maximum_evaluation_days ?? "30"));
  const [consistency, setConsistency] = useState(asInputPercent(initialRules.consistency_max_day_profit_pct, "35"));

  async function submit() {
    setStatus("saving");
    const response = await fetch(`/api/analyses/${analysisId}/prop-evaluation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: {
          schema_version: "prop_evaluation_rules_v1",
          source: "post_run_edit",
          label,
          firm_label: label,
          account_size: parsePositive(accountSize),
          profit_target_pct: parsePercent(profitTarget),
          max_total_drawdown_pct: parsePercent(totalDrawdown),
          total_drawdown_basis: "static",
          max_daily_loss_pct: parsePercent(dailyLoss),
          daily_loss_basis: "closed_balance",
          reset_timezone: "UTC",
          minimum_trading_days: parsePositive(minimumDays),
          maximum_evaluation_days: parsePositive(maximumDays),
          consistency_max_day_profit_pct: parsePercent(consistency),
        },
      }),
    });
    if (!response.ok) {
      setStatus("failed");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Rule profile" value={label} onChange={setLabel} type="text" />
        <Input label="Account size" value={accountSize} onChange={setAccountSize} />
        <Input label="Profit target (%)" value={profitTarget} onChange={setProfitTarget} />
        <Input label="Max total drawdown (%)" value={totalDrawdown} onChange={setTotalDrawdown} />
        <Input label="Max daily loss (%)" value={dailyLoss} onChange={setDailyLoss} />
        <Input label="Minimum trading days" value={minimumDays} onChange={setMinimumDays} step="1" />
        <Input label="Maximum evaluation days" value={maximumDays} onChange={setMaximumDays} step="1" />
        <Input label="Max single-day profit share (%)" value={consistency} onChange={setConsistency} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonVariants({ variant: "primary" })} onClick={() => void submit()} disabled={status === "saving"}>
          {status === "saving" ? "Recomputing..." : "Recompute Readiness"}
        </button>
        {status === "saved" ? <p className="text-xs text-chart-positive">Updated.</p> : null}
        {status === "failed" ? <p className="text-xs text-red-600">Could not recompute. Check the rule values and try again.</p> : null}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "number",
  step = "0.01",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  step?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-text-institutional">{label}</span>
      <input
        className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? step : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
