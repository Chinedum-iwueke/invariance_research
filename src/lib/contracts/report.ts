export interface ReportPayload {
  report_id: string;
  generated_at?: string;
  executive_summary: string;
  diagnostics_summary: string[];
  methodology_assumptions: string[];
  recommendations: string[];
  export_ready: boolean;
}
