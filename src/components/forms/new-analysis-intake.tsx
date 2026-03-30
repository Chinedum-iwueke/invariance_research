"use client";

import { useMemo, useState } from "react";
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
  const [clientError, setClientError] = useState<string | null>(null);
  const [benchmarkSelection, setBenchmarkSelection] = useState<BenchmarkSelectionValue>({ mode: "auto", requested_id: null });
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
      body: JSON.stringify({ artifact_id: inspection.artifact_id, benchmark: benchmarkSelection }),
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
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <WorkspaceCard title="Upload research artifact" subtitle="Trade CSV, structured bundle, or parameter sweep bundle ZIP">
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
            <p className="mt-1 text-xs text-text-neutral">Accepted: .csv (trade history), .zip (Bundle Manifest v1 / parameter sweep bundle)</p>
            <input
              className="mt-4 block w-full text-xs"
              type="file"
              accept=".csv,.zip"
              onChange={(event) => {
                const selected = event.target.files?.item(0);
                if (selected) void onInspect(selected);
              }}
            />
          </div>
          <p className="mt-3 text-xs text-text-neutral">Files are processed server-side. The frontend does not parse raw artifact contents.</p>
        </WorkspaceCard>

        <WorkspaceCard title="Eligibility summary" subtitle="Backend-derived diagnostic truth">
          {!inspection && <p className="text-sm text-text-neutral">Upload an artifact to generate eligibility output.</p>}
          {inspection && (
            <div className="space-y-2 text-sm text-text-neutral">
              <p>{inspection.upload_summary_text}</p>
              <p className="text-xs">Available: {inspection.diagnostics_available.join(", ") || "None"}</p>
              <p className="text-xs">Limited: {inspection.diagnostics_limited.join(", ") || "None"}</p>
              <p className="text-xs">Unavailable: {inspection.diagnostics_unavailable.join(", ") || "None"}</p>
              {limitationList.length > 0 && (
                <ul className="list-disc pl-5 text-xs">
                  {limitationList.map((reason) => (
                    <li key={reason}>{reason}</li>
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
            </div>
          )}
        </WorkspaceCard>

        <WorkspaceCard title="Analysis orchestration" subtitle="Step 3: choose runtime options, then run analysis">
          <BenchmarkSelector value={benchmarkSelection} onChange={setBenchmarkSelection} />
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

        <WorkspaceCard title="Confidentiality" subtitle="Institutional handling">
          <p className="text-sm text-text-neutral">Artifacts are retained in controlled backend storage and only exposed as structured product-safe payloads.</p>
        </WorkspaceCard>
      </div>

      <div className="space-y-4">
        <WorkspaceCard title="Intake guidance" subtitle="What to upload for each analysis path">
          <ul className="space-y-2 text-sm text-text-neutral">
            <li>• Trade-only upload: a closed-trades CSV for baseline diagnostics.</li>
            <li>• Structured bundle upload: manifest + trades + optional assumptions/context files.</li>
            <li>• Parameter sweep bundle (required for baseline Parameter Stability): multi-run results across parameter combinations with run-to-parameter metadata.</li>
          </ul>
        </WorkspaceCard>

        <WorkspaceCard title="Supported sweep formats" subtitle="Operator-friendly bundle contract">
          <ul className="space-y-2 text-sm text-text-neutral">
            <li>• Preferred: one ZIP bundle with <code>manifest.json</code> plus per-run trade/result files and explicit run_id → parameter values mapping.</li>
            <li>• Advanced: one combined table that includes <code>run_id</code>, parameter columns, and trade/result fields for each run.</li>
            <li>• OHLCV/regime files are optional for baseline Parameter Stability and may support richer future variants.</li>
          </ul>
        </WorkspaceCard>
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
