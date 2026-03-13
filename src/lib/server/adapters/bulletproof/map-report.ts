import type { ReportPayload } from "@/lib/contracts";
import type { RawReportResult } from "@/lib/server/adapters/bulletproof/types";

export function mapRawReportToReportPayload(raw: RawReportResult | undefined, reportId: string): ReportPayload {
  return {
    report_id: reportId,
    generated_at: raw?.generatedAt,
    executive_summary: raw?.executiveSummary ?? "Report pending backend integration.",
    diagnostics_summary: ["Overview", "Distribution", "Monte Carlo", "Execution", "Regimes", "Ruin"],
    methodology_assumptions: raw?.assumptions ?? ["Assumptions pending backend integration"],
    recommendations: raw?.recommendations ?? ["Recommendations pending backend integration"],
    export_ready: false,
  };
}
