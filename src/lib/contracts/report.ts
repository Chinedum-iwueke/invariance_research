import type { FigurePayload } from "@/lib/contracts/figures";

export interface ReportPayload {
  report_id: string;
  generated_at?: string;
  executive_summary: string;
  diagnostics_summary: string[];
  methodology_assumptions: string[];
  limitations: string[];
  recommendations: string[];
  confidence?: string;
  verdict?: "robust" | "moderate" | "fragile";
  deployment_guidance: string[];
  figures: FigurePayload[];
  source: "engine_report" | "report_diagnostic_alias" | "summary_fallback";
  export_ready: boolean;
}
