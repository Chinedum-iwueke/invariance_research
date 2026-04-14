"use client";

import { useMemo, useState } from "react";
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

const MAX_BYTES = 10 * 1024 * 1024;

export function NewAnalysisIntake() {
  const [state, setState] = useState<IntakeState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<UploadInspectionResponse | null>(null);
  const [status, setStatus] = useState<AnalysisStatusResponse | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [strategyName, setStrategyName] = useState<string>("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [benchmarkSelection, setBenchmarkSelection] = useState<BenchmarkSelectionValue>({ mode: "auto", requested_id: null });
  const [accountSize, setAccountSize] = useState<string>("100000");
  const [riskPerTradePct, setRiskPerTradePct] = useState<string>("1");
  const [apiErrorCode, setApiErrorCode] = useState<string | null>(null);
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
    if (fileToInspect.size > MAX_BYTES) {
      setClientError("File exceeds 10MB upload limit.");
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

  return (
    <div className="space-y-4">
      <WorkspaceCard title="Upload research artifact" subtitle="Trade CSV or structured bundle ZIP">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-neutral">If you are unsure what to upload, use the canonical lab specification.</p>
          <Link href="/docs/lab" className={buttonVariants({ variant: "primary", size: "sm" })}>View Upload Docs</Link>
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
          </p>
        </div>
        <p className="mt-3 text-xs text-text-neutral">Files are processed server-side.</p>
      </WorkspaceCard>

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
            planHint="Professional and Research Lab increase monthly analysis throughput."
          />
        )}
        {isUploadPlanRestricted(apiErrorCode) && (
          <DiagnosticLockPanel
            model={buildDiagnosticLockModel({
              state: "plan_locked",
              diagnosticTitle: "Advanced Artifact Upload",
              diagnosticPurpose: "Upload structured or research bundles to unlock richer eligibility and diagnostics.",
              requiredPlan: "Professional",
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

      <WorkspaceCard title="Eligibility summary" subtitle="Backend-derived diagnostic truth and artifact review">
        {!inspection && <p className="text-sm text-text-neutral">Upload an artifact to generate eligibility output.</p>}
        {inspection && (
          <div className="space-y-3 text-sm text-text-neutral">
            <p>{inspection.upload_summary_text}</p>
            <p className="text-xs">Available: {inspection.diagnostics_available.join(", ") || "None"}</p>
            <p className="text-xs">Limited: {inspection.diagnostics_limited.join(", ") || "None"}</p>
            <p className="text-xs">Unavailable: {inspection.diagnostics_unavailable.join(", ") || "None"}</p>
            {limitationList.length > 0 && (
              <ul className="list-disc pl-5 text-xs">
                {limitationList.map((reason, index) => (
                  <li key={`limitation-${index}-${reason.slice(0, 24)}`}>{reason}</li>
                ))}
              </ul>
            )}
            {inspection.validation_errors.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-red-600">
                {inspection.validation_errors.map((error) => (
                  <li key={`${error.code}-${error.message}`}>{error.message}</li>
                ))}
              </ul>
            )}
            <UploadReviewPanel inspection={inspection} />
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Confidentiality" subtitle="Institutional handling">
        <p className="text-sm text-text-neutral">Artifacts are retained in controlled backend storage and only exposed as structured product-safe payloads.</p>
      </WorkspaceCard>
    </div>
  );
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
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border-subtle">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-white">
            <tr>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">File</th>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">Type</th>
              <th className="border-b border-border-subtle px-2 py-1 text-left font-medium text-text-institutional">Status</th>
            </tr>
          </thead>
          <tbody>
            {review.entries.map((entry) => (
              <tr key={entry.path} className="border-b border-border-subtle/50">
                <td className="px-2 py-1 text-text-neutral">{entry.path}</td>
                <td className="px-2 py-1 text-text-neutral uppercase">{entry.file_type}</td>
                <td className="px-2 py-1 text-text-neutral">
                  {entry.status}
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
