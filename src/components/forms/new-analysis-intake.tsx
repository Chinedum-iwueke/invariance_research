"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalysisStatusResponse,
  CreateAnalysisResponse,
  UploadInspectionResponse,
} from "@/lib/contracts";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const router = useRouter();

  const limitationList = useMemo(() => inspection?.limitation_reasons ?? [], [inspection]);

  async function onInspect(fileToInspect: File) {
    setClientError(null);
    const extension = fileToInspect.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "zip"].includes(extension)) {
      setClientError("Unsupported file type. Please upload a trade CSV or bundle ZIP.");
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
      body: JSON.stringify({ artifact_id: inspection.artifact_id }),
    });

    if (!response.ok) {
      setState("failed");
      setClientError("Unable to create analysis job.");
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
      <WorkspaceCard title="Upload research artifact" subtitle="Trade CSV or structured bundle ZIP">
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
        </div>
        <p className="mt-3 text-xs text-text-neutral">Files are processed server-side. The frontend does not parse raw artifact contents.</p>
      </WorkspaceCard>

      <div className="space-y-4">
        <WorkspaceCard title="Intake guidance" subtitle="Clinical validation posture">
          <ul className="space-y-2 text-sm text-text-neutral">
            <li>• Include complete closed-trade history.</li>
            <li>• Bundle assumptions and context for richer diagnostics.</li>
            <li>• Eligibility is determined by backend parser evidence only.</li>
          </ul>
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

        <WorkspaceCard title="Analysis orchestration" subtitle="Queued and processing states">
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
    </div>
  );
}
