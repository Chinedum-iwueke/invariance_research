import { figurePayloadSchema } from "@/lib/contracts/figures.schema";
import { z } from "zod";

export const reportPayloadSchema = z.object({
  report_id: z.string(),
  generated_at: z.string().optional(),
  executive_summary: z.string(),
  diagnostics_summary: z.array(z.string()),
  methodology_assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.string().optional(),
  verdict: z.enum(["robust", "moderate", "fragile"]).optional(),
  deployment_guidance: z.array(z.string()),
  figures: z.array(figurePayloadSchema),
  source: z.enum(["engine_report", "report_diagnostic_alias", "summary_fallback"]),
  export_ready: z.boolean(),
});
