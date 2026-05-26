"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AnalysisStatusResponse,
  CreateAnalysisResponse,
  UploadInspectionResponse,
} from "@/lib/contracts";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { BenchmarkSelector, type BenchmarkSelectionValue } from "@/components/analysis/BenchmarkSelector";
import { BenchmarkSuggestion } from "@/components/analysis/BenchmarkSuggestion";
import { buttonVariants } from "@/components/ui/button";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { isQuotaExceeded, isUploadPlanRestricted } from "@/lib/app/upgrade-visibility";
import { cn } from "@/lib/utils";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { DiagnosticName } from "@/lib/server/ingestion";

type IntakeState =
  | "idle"
  | "drag_over"
  | "validating"
  | "eligibility_ready"
  | "submitting"
  | "queued"
  | "processing"
  | "success"
  | "failed";

const MAX_BROWSER_UPLOAD_BYTES = 250 * 1024 * 1024;
const CLAIM_PRESETS = [
  "Profitable after realistic costs",
  "Robust enough for live deployment",
  "Prop-firm evaluation ready",
  "Not dependent on one favorable regime",
  "Investor or buyer ready",
] as const;

export function NewAnalysisIntake() {
  const [state, setState] = useState<IntakeState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<UploadInspectionResponse | null>(null);
  const [status, setStatus] = useState<AnalysisStatusResponse | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [strategyName, setStrategyName] = useState<string>("");
  const [claimDraft, setClaimDraft] = useState<string>("");
  const [declaredClaims, setDeclaredClaims] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [benchmarkSelection, setBenchmarkSelection] = useState<BenchmarkSelectionValue>({ mode: "auto", requested_id: null });
  const [accountSize, setAccountSize] = useState<string>("100000");
  const [riskPerTradePct, setRiskPerTradePct] = useState<string>("1");
  const [useCustomPropRules, setUseCustomPropRules] = useState<boolean>(false);
  const [propFirmLabel, setPropFirmLabel] = useState<string>("");
  const [propProfitTargetPct, setPropProfitTargetPct] = useState<string>("8");
  const [propMaxTotalDrawdownPct, setPropMaxTotalDrawdownPct] = useState<string>("10");
  const [propMaxDailyLossPct, setPropMaxDailyLossPct] = useState<string>("5");
  const [propMinimumTradingDays, setPropMinimumTradingDays] = useState<string>("5");
  const [propMaximumEvaluationDays, setPropMaximumEvaluationDays] = useState<string>("30");
  const [propConsistencyMaxDayPct, setPropConsistencyMaxDayPct] = useState<string>("35");
  const [apiErrorCode, setApiErrorCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const limitationList = useMemo(() => inspection?.limitation_reasons ?? [], [inspection]);

  async function onInspect(fileToInspect: File) {
    setClientError(null);
    setApiErrorCode(null);
    const extension = fileToInspect.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "zip"].includes(extension)) {
      setClientError("Unsupported file type. Please upload a trade CSV or structured bundle ZIP.");
      return;
    }
    if (fileToInspect.size <= 0) {
      setClientError("File is empty.");
      return;
    }
    if (fileToInspect.size > MAX_BROWSER_UPLOAD_BYTES) {
      setClientError("File exceeds the browser upload limit. Use a smaller evidence package or contact Research Desk.");
      return;
    }

    setFile(fileToInspect);
    setState("validating");

    const formData = new FormData();
    formData.append("file", fileToInspect);

    const response = await fetch("/api/uploads/inspect", { method: "POST", body: formData });
    const payload = (await response.json()) as UploadInspectionResponse;
    setInspection(payload);

    if (!response.ok || !payload.accepted) {
      setState("failed");
      if (payload.validation_errors?.some((error) => `${error.code}` === "plan_upload_locked")) {
        setApiErrorCode("plan_upload_locked");
      }
      return;
    }

    setState("eligibility_ready");
  }

  async function startAnalysis() {
    if (!inspection?.artifact_id) return;
    setState("submitting");

    const response = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_id: inspection.artifact_id,
        strategy_name: strategyName.trim() || undefined,
        benchmark: benchmarkSelection,
        runtime_config: {
          account_size: parsePositiveNumber(accountSize),
          risk_per_trade_pct: parsePositiveNumber(riskPerTradePct),
          declared_claims: declaredClaims.map((claim, index) => ({
            claim_id: `user_claim_${index + 1}`,
            claim,
            source: "analysis_intake",
            priority: index === 0 ? "critical" : "high",
          })),
          prop_evaluation_rules: useCustomPropRules
            ? {
                schema_version: "prop_evaluation_rules_v1",
                source: "runtime",
                label: propFirmLabel.trim() || "Runtime prop evaluation",
                firm_label: propFirmLabel.trim() || undefined,
                account_size: parsePositiveNumber(accountSize),
                profit_target_pct: parsePercentNumber(propProfitTargetPct),
                max_total_drawdown_pct: parsePercentNumber(propMaxTotalDrawdownPct),
                total_drawdown_basis: "static",
                max_daily_loss_pct: parsePercentNumber(propMaxDailyLossPct),
                daily_loss_basis: "closed_balance",
                reset_timezone: "UTC",
                minimum_trading_days: parsePositiveInteger(propMinimumTradingDays),
                maximum_evaluation_days: parsePositiveInteger(propMaximumEvaluationDays),
                consistency_max_day_profit_pct: parsePercentNumber(propConsistencyMaxDayPct),
              }
            : undefined,
        },
      }),
    });

    if (!response.ok) {
      setState("failed");
      const payload = (await response.json()) as { error?: { code?: string; message?: string } };
      setApiErrorCode(payload.error?.code ?? "analysis_start_failed");
      setClientError(payload.error?.message ?? "Unable to create analysis job.");
      return;
    }

    const payload = (await response.json()) as CreateAnalysisResponse;
    setAnalysisId(payload.analysis_id);
    setState("queued");
    void pollStatus(payload.analysis_id, payload.next_urls.overview);
  }

  async function pollStatus(id: string, overviewUrl: string) {
    while (true) {
      const response = await fetch(`/api/analyses/${id}/status`, { cache: "no-store" });
      const payload = (await response.json()) as AnalysisStatusResponse;
      setStatus(payload);

      if (!response.ok) {
        setState("failed");
        return;
      }

      if (payload.job_status === "queued") setState("queued");
      if (payload.job_status === "processing") setState("processing");
      if (payload.job_status === "completed") {
        setState("success");
        router.push(overviewUrl);
        return;
      }
      if (payload.job_status === "failed") {
        setState("failed");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const suggestion = useMemo(() => suggestBenchmarkFromInspection(inspection), [inspection]);

  async function retry() {
    if (!analysisId) return;
    const response = await fetch(`/api/analyses/${analysisId}/retry`, { method: "POST" });
    if (!response.ok) {
      setClientError("Retry is not available for this analysis.");
      return;
    }
    setState("queued");
    void pollStatus(analysisId, `/app/analyses/${analysisId}/overview`);
  }

  function clearSelectedFile() {
    setFile(null);
    setInspection(null);
    setStatus(null);
    setAnalysisId(null);
    setClientError(null);
    setApiErrorCode(null);
    setState("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function addClaim(value: string) {
    const claim = value.trim().replace(/\s+/g, " ");
    if (!claim) return;
    setDeclaredClaims((current) => {
      if (current.some((item) => item.toLowerCase() === claim.toLowerCase())) return current;
      return [...current, claim].slice(0, 8);
    });
    setClaimDraft("");
  }

  function removeClaim(index: number) {
    setDeclaredClaims((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-4">
      <WorkspaceCard title="Upload research artifact" subtitle="Trade CSV or structured bundle ZIP">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-neutral">Use a trade CSV for a quick read, or a research bundle ZIP for the strongest automated diagnostic coverage.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/downloads/strategy-truth-room-research-bundle-reference.zip" className={buttonVariants({ variant: "secondary", size: "sm" })}>Download Reference Bundle</Link>
            <Link href="/docs/lab" className={buttonVariants({ variant: "primary", size: "sm" })}>View Upload Docs</Link>
          </div>
        </div>
        <div className="mb-4 grid gap-2 text-xs text-text-neutral md:grid-cols-3">
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-semibold text-text-institutional">Trade CSV</p>
            <p className="mt-1">Fast baseline validation from closed trades.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-semibold text-text-institutional">Rich CSV</p>
            <p className="mt-1">Add fees, MAE/MFE, risk, and R fields for stronger diagnostics.</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
            <p className="font-semibold text-text-institutional">Research ZIP</p>
            <p className="mt-1">Add manifest, OHLCV, broker export, claims, and parameter sweep files.</p>
          </div>
        </div>
        <div
          className={cn(
            "rounded-md border border-dashed bg-surface-panel/60 p-8 text-center",
            state === "drag_over" ? "border-brand" : "border-border",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setState("drag_over");
          }}
          onDragLeave={() => setState("idle")}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files.item(0);
            if (dropped) void onInspect(dropped);
          }}
        >
          <p className="text-sm font-medium">Submit artifact into validation intake</p>
          <p className="mt-1 text-xs text-text-neutral">Accepted: .csv (trade history), .zip (Bundle Manifest v1)</p>
          <input
            ref={fileInputRef}
            className="mt-4 block w-full text-xs"
            type="file"
            accept=".csv,.zip"
            onChange={(event) => {
              const selected = event.target.files?.item(0);
              if (selected) void onInspect(selected);
            }}
          />
          <p className="mt-2 text-xs text-text-neutral">
            <Link href="/docs/lab" className="underline underline-offset-2 hover:text-text-graphite">What files are accepted?</Link>
            <span className="mx-2 text-border">|</span>
            <Link href="/downloads/strategy-truth-room-research-bundle-reference.zip" className="underline underline-offset-2 hover:text-text-graphite">Download a format reference ZIP</Link>
          </p>
          {file ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-text-neutral">
              <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1">Selected: {file.name}</span>
              <button type="button" onClick={clearSelectedFile} className="inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-surface-white px-2 py-1 hover:border-border hover:text-text-graphite">
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-text-neutral">Files are processed server-side.</p>
        {inspection ? (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <UploadReviewPanel inspection={inspection} />
          </div>
        ) : null}
      </WorkspaceCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WorkspaceCard title="Analysis orchestration" subtitle="Step 2: choose benchmark/runtime options, then run analysis">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-text-institutional">Strategy name</span>
                <input
                  className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
                  type="text"
                  maxLength={120}
                  placeholder="e.g., Mean Reversion v3"
                  value={strategyName}
                  onChange={(event) => setStrategyName(event.target.value)}
                />
                <span className="text-xs text-text-neutral">Used in Workspace Home and analysis summaries. Leave blank to use upload-derived fallback naming.</span>
              </label>
            </div>
            <BenchmarkSelector value={benchmarkSelection} onChange={setBenchmarkSelection} />
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-institutional">Claims to test</p>
                  <p className="mt-1 text-xs leading-5 text-text-neutral">
                    State what you believe this artifact proves. These claims are carried into the assumption ledger, proof report, share room, and Research Desk packet.
                  </p>
                </div>
                <span className="rounded-full border border-border-subtle bg-surface-white px-2.5 py-1 text-xs text-text-neutral">{declaredClaims.length}/8 claims</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {CLAIM_PRESETS.map((claim) => (
                  <button
                    key={claim}
                    type="button"
                    onClick={() => addClaim(claim)}
                    className="rounded-full border border-border-subtle bg-surface-white px-3 py-1.5 text-xs font-medium text-text-graphite transition hover:border-brand/35 hover:text-brand"
                  >
                    {claim}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-h-10 flex-1 rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
                  type="text"
                  maxLength={280}
                  placeholder="e.g., This strategy can survive a 5 bps slippage increase."
                  value={claimDraft}
                  onChange={(event) => setClaimDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addClaim(claimDraft);
                    }
                  }}
                />
                <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => addClaim(claimDraft)}>Add claim</button>
              </div>
              {declaredClaims.length ? (
                <div className="mt-3 space-y-2">
                  {declaredClaims.map((claim, index) => (
                    <div key={`${index}-${claim}`} className="flex items-start justify-between gap-3 rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-neutral">
                      <p className="leading-6"><span className="font-medium text-text-graphite">Claim {index + 1}:</span> {claim}</p>
                      <button type="button" onClick={() => removeClaim(index)} className="mt-0.5 rounded-sm p-1 text-text-neutral hover:bg-surface-panel hover:text-text-graphite" aria-label={`Remove claim ${index + 1}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-text-neutral">Optional for quick CSV runs, but strongly recommended. Without declared claims, the Lab will only test claims implied by the artifact and report language.</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-text-institutional">Account size</span>
                <input
                  className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
                  type="number"
                  min={1}
                  step="any"
                  value={accountSize}
                  onChange={(event) => setAccountSize(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-text-institutional">Risk per trade (%)</span>
                <input
                  className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={riskPerTradePct}
                  onChange={(event) => setRiskPerTradePct(event.target.value)}
                />
              </label>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-text-institutional">
                <input
                  type="checkbox"
                  checked={useCustomPropRules}
                  onChange={(event) => setUseCustomPropRules(event.target.checked)}
                />
                Add prop evaluation rules for this run
              </label>
              {useCustomPropRules ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 md:col-span-3">
                    <span className="text-sm font-medium text-text-institutional">Prop firm / challenge label</span>
                    <input
                      className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
                      type="text"
                      maxLength={80}
                      value={propFirmLabel}
                      onChange={(event) => setPropFirmLabel(event.target.value)}
                      placeholder="e.g., FTMO 100K Challenge"
                    />
                  </label>
                  <NumberField label="Profit target (%)" value={propProfitTargetPct} onChange={setPropProfitTargetPct} />
                  <NumberField label="Max total drawdown (%)" value={propMaxTotalDrawdownPct} onChange={setPropMaxTotalDrawdownPct} />
                  <NumberField label="Max daily loss (%)" value={propMaxDailyLossPct} onChange={setPropMaxDailyLossPct} />
                  <NumberField label="Minimum trading days" value={propMinimumTradingDays} onChange={setPropMinimumTradingDays} step="1" />
                  <NumberField label="Maximum evaluation days" value={propMaximumEvaluationDays} onChange={setPropMaximumEvaluationDays} step="1" />
                  <NumberField label="Max single-day profit share (%)" value={propConsistencyMaxDayPct} onChange={setPropConsistencyMaxDayPct} />
                </div>
              ) : (
                <p className="mt-2 text-xs text-text-neutral">Default fallback rules will be used, and you can replace them from the Prop Evaluation tab after the run.</p>
              )}
            </div>
            {benchmarkSelection.mode === "auto" && (
              <BenchmarkSuggestion suggestedId={suggestion.id} reason={suggestion.reason} />
            )}
            <p className="text-sm text-text-neutral">State: {state.replaceAll("_", " ")}</p>
            {file && <p className="text-xs text-text-neutral">Artifact: {file.name}</p>}
            {status && (
              <div className="text-xs text-text-neutral">
                <p>Step: {status.current_step ?? "Pending"}</p>
                <p>Progress: {status.progress_pct ?? 0}%</p>
                <p>{status.message}</p>
              </div>
            )}
            {clientError && <p className="text-xs text-red-600">{clientError}</p>}
            {isQuotaExceeded(apiErrorCode) && (
              <UpgradePanel
                title="Monthly analysis limit reached"
                explanation="You have reached your current monthly analysis capacity. Upgrade to continue running additional diagnostics this month."
                planHint="Individual and Pro increase self-serve throughput. Research Desk is scoped separately."
              />
            )}
            {isUploadPlanRestricted(apiErrorCode) && (
              <DiagnosticLockPanel
                model={buildDiagnosticLockModel({
                  state: "plan_locked",
                  diagnosticTitle: "Advanced Artifact Upload",
                  diagnosticPurpose: "Upload structured or research bundles to unlock richer eligibility and diagnostics.",
                  requiredPlan: "Individual",
                })}
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={buttonVariants({ variant: "primary" })}
                disabled={state !== "eligibility_ready"}
                onClick={() => void startAnalysis()}
              >
                Proceed to Run Analysis
              </button>
              <button
                className={buttonVariants({ variant: "secondary" })}
                onClick={() => void retry()}
                disabled={state !== "failed" || !analysisId}
              >
                Retry
              </button>
              <button className={buttonVariants({ variant: "tertiary" })} onClick={() => router.push("/app/analyses")}>Return to Analyses</button>
            </div>
          </WorkspaceCard>
        </div>

        <WorkspaceCard title="Eligibility summary" subtitle="Backend-derived diagnostic truth">
          {!inspection && <p className="text-sm text-text-neutral">Upload an artifact to generate eligibility output.</p>}
          {inspection && (
            <div className="space-y-4 text-sm text-text-neutral">
              <p className="leading-6">{inspection.upload_summary_text}</p>
              <div className="grid gap-2">
                {eligibilityTiles(inspection, { hasRuntimePropRules: useCustomPropRules }).map((tile) => (
                  <div key={tile.label} className={cn(
                    "rounded-md border bg-surface-white px-3 py-3",
                    tile.tone === "supported" && "border-chart-positive/25 bg-chart-positive/10",
                    tile.tone === "limited" && "border-amber-500/25 bg-amber-500/10",
                    tile.tone === "locked" && "border-border-subtle bg-surface-panel",
                  )}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text-institutional">{tile.label}</p>
                      <span className={cn(
                        "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        tile.tone === "supported" && "border-chart-positive/25 bg-surface-white text-chart-positive",
                        tile.tone === "limited" && "border-amber-500/25 bg-surface-white text-amber-700",
                        tile.tone === "locked" && "border-border-subtle bg-surface-white text-text-neutral",
                      )}>{tile.state}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-text-neutral">{tile.detail}</p>
                  </div>
                ))}
              </div>
              {limitationList.length > 0 && (
                <div className="rounded-md border border-border-subtle bg-surface-subtle p-3 text-xs leading-5">
                  <p className="font-semibold text-text-graphite">Evidence needed next</p>
                  {limitationList.map((reason, index) => (
                    <p key={`limitation-${index}-${reason.slice(0, 24)}`} className="mt-2 rounded-sm border border-border-subtle bg-surface-white px-2 py-2">{reason}</p>
                  ))}
                </div>
              )}
              {inspection.validation_errors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-semibold">Validation errors</p>
                  {inspection.validation_errors.map((error) => (
                    <p key={`${error.code}-${error.message}`} className="mt-2">{error.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </WorkspaceCard>
      </div>
    </div>
  );
}

const ELIGIBILITY_TILE_ORDER: Array<{ diagnostic: DiagnosticName; label: string; available: string; limited: string; unavailable: string }> = [
  { diagnostic: "overview", label: "Overview", available: "Report-ready", limited: "Supported with caveats", unavailable: "Unavailable" },
  { diagnostic: "execution", label: "Execution", available: "Assumptions visible", limited: "Limited", unavailable: "Needs execution context" },
  { diagnostic: "monte_carlo", label: "Monte Carlo", available: "Crash-test ready", limited: "Bounded confidence", unavailable: "Unavailable" },
  { diagnostic: "ruin", label: "Ruin", available: "Survivability ready", limited: "Bounded confidence", unavailable: "Unavailable" },
  { diagnostic: "prop_evaluation_readiness", label: "Prop Evaluation", available: "Rules active", limited: "Fallback rules", unavailable: "Unavailable" },
  { diagnostic: "report", label: "Report", available: "Safe with caveats", limited: "Limited", unavailable: "Unavailable" },
];

function eligibilityTiles(inspection: UploadInspectionResponse, runtime: { hasRuntimePropRules: boolean }) {
  return ELIGIBILITY_TILE_ORDER.map((tile) => {
    if (tile.diagnostic === "prop_evaluation_readiness" && runtime.hasRuntimePropRules && inspection.diagnostics_limited.includes(tile.diagnostic)) {
      return {
        label: tile.label,
        state: "Runtime rules active",
        detail: "Exact challenge rules have been entered for this run and will replace fallback prop-evaluation assumptions when analysis starts.",
        tone: "supported" as const,
      };
    }
    if (inspection.diagnostics_available.includes(tile.diagnostic)) {
      return { label: tile.label, state: tile.available, detail: "Supported by this upload and eligible for the automated report.", tone: "supported" as const };
    }
    if (inspection.diagnostics_limited.includes(tile.diagnostic)) {
      return { label: tile.label, state: tile.limited, detail: diagnosticLimitedDetail(tile.diagnostic), tone: "limited" as const };
    }
    return { label: tile.label, state: tile.unavailable, detail: diagnosticUnavailableDetail(tile.diagnostic), tone: "locked" as const };
  });
}

function diagnosticLimitedDetail(diagnostic: DiagnosticName) {
  if (diagnostic === "execution") return "The Lab can show assumptions and sensitivity, but broker-level realism needs richer execution evidence or Research Desk review.";
  if (diagnostic === "prop_evaluation_readiness") return "Fallback rules can be used. Add exact challenge rules for a decision-grade prop evaluation.";
  if (diagnostic === "monte_carlo" || diagnostic === "ruin") return "Path stress is available, but confidence depends on trade count, sizing fields, and explicit risk assumptions.";
  return "The diagnostic can be shown, but the report will carry explicit caveats.";
}

function diagnosticUnavailableDetail(diagnostic: DiagnosticName) {
  if (diagnostic === "execution") return "Upload fees, slippage, spread, broker fills, or execution assumptions.";
  if (diagnostic === "prop_evaluation_readiness") return "Upload closed trades and prop-rule settings.";
  return "Upload evidence that directly supports this diagnostic, or route it to Research Desk.";
}

function UploadReviewPanel({ inspection }: { inspection: UploadInspectionResponse }) {
  if (!inspection.upload_review) return null;

  if (inspection.upload_review.kind === "csv") {
    const preview = inspection.upload_review.csv_preview;
    return (
      <div className="rounded-md border border-border-subtle bg-surface-panel/40 p-3">
        <p className="text-xs font-medium text-text-institutional">Ingestion review · CSV preview</p>
        <p className="mt-1 text-xs text-text-neutral">Showing {preview.row_count_shown} of {preview.row_count_total} rows.</p>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border-subtle">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 bg-surface-white">
              <tr>
                {preview.columns.map((column) => (
                  <th key={column} className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="border-b border-border-subtle/50">
                  {preview.columns.map((_, columnIndex) => (
                    <td key={`cell-${rowIndex}-${columnIndex}`} className="px-2 py-1 text-text-neutral">
                      {row[columnIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const review = inspection.upload_review.zip_review;
  return (
    <div className="rounded-md border border-border-subtle bg-surface-panel/40 p-3">
      <p className="text-xs font-medium text-text-institutional">Ingestion review · ZIP bundle</p>
      <p className="mt-1 text-xs text-text-neutral">
        Recognized {review.recognized_count} · Ignored {review.ignored_count} · Unsupported {review.unsupported_count}
      </p>
      {review.manifest_type || review.contract_version ? (
        <p className="mt-1 text-xs text-text-neutral">
          Manifest: {review.manifest_type ?? "bundle_v1"} · Contract: {review.contract_version ?? "unspecified"}
        </p>
      ) : null}
      {review.diagnostic_unlocks ? (
        <div className="mt-2 grid gap-2 text-xs text-text-neutral md:grid-cols-3">
          <p><span className="font-medium text-text-graphite">Available:</span> {review.diagnostic_unlocks.available.join(", ") || "None"}</p>
          <p><span className="font-medium text-text-graphite">Limited:</span> {review.diagnostic_unlocks.limited.join(", ") || "None"}</p>
          <p><span className="font-medium text-text-graphite">Unavailable:</span> {review.diagnostic_unlocks.unavailable.join(", ") || "None"}</p>
        </div>
      ) : null}
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border-subtle">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-white">
            <tr>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">File</th>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">Role</th>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">Type</th>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">Status</th>
            </tr>
          </thead>
          <tbody>
            {review.entries.map((entry) => (
              <tr key={entry.path} className="border-b border-border-subtle/50">
                <td className="px-2 py-1 text-text-neutral">{entry.path}</td>
                <td className="px-2 py-1 text-text-neutral">{entry.role ?? "legacy"}</td>
                <td className="px-2 py-1 text-text-neutral uppercase">{entry.file_type}</td>
                <td className="px-2 py-1 text-text-neutral">
                  {entry.status}
                  {entry.required ? " · required" : ""}
                  {entry.note ? ` · ${entry.note}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function suggestBenchmarkFromInspection(inspection: UploadInspectionResponse | null): { id: BenchmarkId | null; reason: string } {
  if (!inspection) return { id: null, reason: "Upload an artifact to receive a deterministic benchmark suggestion." };

  const text = [inspection.upload_summary_text, ...inspection.parser_notes, ...inspection.limitation_reasons].join(" ").toLowerCase();

  if (text.includes("crypto") || text.includes("btc") || text.includes("eth")) {
    return { id: "BTC", reason: "Detected crypto strategy context." };
  }
  if (text.includes("equit") || text.includes("stock") || text.includes("spy")) {
    return { id: "SPY", reason: "Detected equities strategy context." };
  }
  if (text.includes("metal") || text.includes("gold") || text.includes("xau")) {
    return { id: "XAUUSD", reason: "Detected metals strategy context." };
  }
  if (text.includes("macro") || text.includes("fx") || text.includes("forex") || text.includes("dxy")) {
    return { id: "DXY", reason: "Detected macro/fx strategy context." };
  }
  return { id: null, reason: "Low confidence detection; benchmark will remain disabled unless manually selected." };
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = parsePositiveNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
}

function parsePercentNumber(value: string): number | undefined {
  const parsed = parsePositiveNumber(value);
  if (parsed === undefined) return undefined;
  return parsed > 1 ? parsed / 100 : parsed;
}

function NumberField({
  label,
  value,
  onChange,
  step = "0.01",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-text-institutional">{label}</span>
      <input
        className="block w-full rounded-md border border-border-subtle bg-surface-white px-3 py-2 text-sm text-text-graphite shadow-sm"
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
