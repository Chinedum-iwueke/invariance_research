"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { DiagnosticLockPanel } from "@/components/dashboard/diagnostic-lock-panel";
import { buildDiagnosticLockModel } from "@/lib/app/diagnostic-locks";
import { isReportExportPlanRestricted } from "@/lib/app/upgrade-visibility";

interface ExportStatusResponse {
  export_id: string;
  format: "pdf" | "md" | "json";
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
  const [activeFormat, setActiveFormat] = useState<"pdf" | "md" | "json">("pdf");
  const [status, setStatus] = useState<ExportStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(false);

  const pollStatus = useCallback(async (exportId: string) => {
    const response = await fetch(`/api/exports/${exportId}`, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error("Unable to fetch export status.");
    const payload = (await response.json()) as ExportStatusResponse;
    setStatus(payload);
  }, []);

  useEffect(() => {
    if (!activeExportId) return;
    if (status?.status === "completed" || status?.status === "failed") return;
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
  }, [activeExportId, pollStatus, status?.status]);


  const startExport = useCallback(async (format: "pdf" | "md" | "json") => {
    setIsStarting(true);
    setError(null);
    setActiveFormat(format);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
        throw new Error(payload?.error?.message ?? "Export request rejected.");
      }

      const payload = await response.json() as { export_id: string };
      setActiveExportId(payload.export_id);
      setStatus({ export_id: payload.export_id, format, status: "queued", current_step: "Queued", progress_pct: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start export.");
    } finally {
      setIsStarting(false);
    }
  }, [analysisId]);

  const info = useMemo(() => {
    if (!status) return "Generate a branded PDF validation memo, Markdown appendix, or JSON evidence packet from the immutable proof-report snapshot.";
    if (status.status === "queued") return `Queued${status.current_step ? ` · ${status.current_step}` : ""}`;
    if (status.status === "processing") return `Rendering ${status.format.toUpperCase()}${typeof status.progress_pct === "number" ? ` · ${status.progress_pct}%` : ""}${status.current_step ? ` · ${status.current_step}` : ""}`;
    if (status.status === "completed") return `Export ready. Download your ${status.format.toUpperCase()} proof report.`;
    return status.error?.message ?? "Export failed. Retry when ready.";
  }, [status]);

  if (isReportExportPlanRestricted(canExport)) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
        <div className="mb-3 grid gap-2 text-xs text-text-neutral md:grid-cols-3">
          <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
            <p className="font-semibold text-text-institutional">PDF memo</p>
            <p className="mt-1">Branded committee-ready validation artifact with charts.</p>
          </div>
          <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
            <p className="font-semibold text-text-institutional">Markdown</p>
            <p className="mt-1">Editable report text for notes, review packets, and follow-up.</p>
          </div>
          <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
            <p className="font-semibold text-text-institutional">JSON</p>
            <p className="mt-1">Machine-readable evidence, assumptions, verdicts, and limits.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["pdf", "md", "json"] as const).map((format) => (
            <Button key={format} type="button" variant={format === "pdf" ? "primary" : "secondary"} onClick={() => setShowPlanDetails((current) => !current)}>
              Export {format.toUpperCase()}
            </Button>
          ))}
          <Link href={`/api/analyses/${analysisId}/report-snapshot`} className={buttonVariants({ variant: "secondary" })}>Preview snapshot contract</Link>
        </div>
        <p className="mt-3 text-sm leading-6 text-text-neutral">Exports are available on paid plans. Select an export format to see the upgrade requirement.</p>
        {showPlanDetails ? (
          <div className="mt-4">
            <DiagnosticLockPanel
              model={buildDiagnosticLockModel({
                state: "plan_locked",
                diagnosticTitle: "Report Export",
                diagnosticPurpose: "Generate a downloadable institutional-grade PDF validation report.",
                currentPlan,
                requiredPlan: "Individual",
              })}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
      <div className="mb-3 grid gap-2 text-xs text-text-neutral md:grid-cols-3">
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="font-semibold text-text-institutional">PDF memo</p>
          <p className="mt-1">Branded committee-ready validation artifact with charts.</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="font-semibold text-text-institutional">Markdown</p>
          <p className="mt-1">Editable report text for notes, review packets, and follow-up.</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="font-semibold text-text-institutional">JSON</p>
          <p className="mt-1">Machine-readable evidence, assumptions, verdicts, and limits.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["pdf", "md", "json"] as const).map((format) => (
          <Button key={format} type="button" variant={format === "pdf" ? "primary" : "secondary"} onClick={() => void startExport(format)} disabled={isStarting || status?.status === "processing" || status?.status === "queued"}>
            {isStarting && activeFormat === format ? "Starting..." : `Export ${format.toUpperCase()}`}
          </Button>
        ))}
        {status?.download_url ? (
          <a href={status.download_url} className={buttonVariants({ variant: "secondary" })}>
            Download {status.format.toUpperCase()}
          </a>
        ) : null}
        <Link href={`/api/analyses/${analysisId}/report-snapshot`} className={buttonVariants({ variant: "secondary" })}>Preview snapshot contract</Link>
      </div>
      {status?.status === "processing" || status?.status === "queued" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-white">
          <div className="h-full bg-research-red transition-all" style={{ width: `${Math.max(5, status.progress_pct ?? 8)}%` }} />
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-text-neutral">{error ?? info}</p>
    </div>
  );
}
