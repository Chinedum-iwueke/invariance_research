"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { isReportExportPlanRestricted } from "@/lib/app/upgrade-visibility";

interface ExportStatusResponse {
  export_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress_pct?: number;
  current_step?: string;
  download_url?: string;
  error?: { code: string; message: string };
}

export function ReportExportActions({
  analysisId,
  canExport,
  currentPlan,
}: {
  analysisId: string;
  canExport: boolean;
  currentPlan?: string;
}) {
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const pollStatus = useCallback(async (exportId: string) => {
    const response = await fetch(`/api/exports/${exportId}`, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("Unable to fetch export status.");
    const payload = (await response.json()) as ExportStatusResponse;
    setStatus(payload);
  }, []);

  useEffect(() => {
    if (!activeExportId) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        await pollStatus(activeExportId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export status unavailable.");
      }
    };

    void tick();
    interval = setInterval(() => {
      void tick();
    }, 1500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeExportId, pollStatus]);


  const startExport = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format: "pdf" }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
        throw new Error(payload?.error?.message ?? "Export request rejected.");
      }

      const payload = await response.json() as { export_id: string };
      setActiveExportId(payload.export_id);
      setStatus({ export_id: payload.export_id, status: "queued", current_step: "Queued", progress_pct: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start export.");
    } finally {
      setIsStarting(false);
    }
  }, [analysisId]);

  const info = useMemo(() => {
    if (!status) return "Generate a polished PDF report artifact for client delivery.";
    if (status.status === "queued") return `Queued${status.current_step ? ` · ${status.current_step}` : ""}`;
    if (status.status === "processing") return `Rendering PDF${typeof status.progress_pct === "number" ? ` · ${status.progress_pct}%` : ""}${status.current_step ? ` · ${status.current_step}` : ""}`;
    if (status.status === "completed") return "Export ready. Download your institutional report PDF.";
    return status.error?.message ?? "Export failed. Retry when ready.";
  }, [status]);

  if (isReportExportPlanRestricted(canExport)) {
    return (
      <DiagnosticLockPanel
        model={buildDiagnosticLockModel({
          state: "plan_locked",
          diagnosticTitle: "Report Export",
          diagnosticPurpose: "Generate a downloadable institutional-grade PDF validation report.",
          currentPlan,
          requiredPlan: "Professional",
        })}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void startExport()} disabled={isStarting || status?.status === "processing" || status?.status === "queued"}>
          {isStarting ? "Starting export…" : status?.status === "processing" ? "Export in progress…" : "Export polished PDF"}
        </Button>
        {status?.download_url ? (
          <a href={status.download_url} className={buttonVariants({ variant: "secondary" })}>
            Download PDF
          </a>
        ) : null}
        <Link href={`/api/analyses/${analysisId}`} className={buttonVariants({ variant: "secondary" })}>View raw analysis payload</Link>
      </div>
      <p className="text-sm text-text-neutral">{error ?? info}</p>
    </div>
  );
}
