import { z } from "zod";

export const reportPayloadSchema = z.object({
  report_id: z.string(),
  generated_at: z.string().optional(),
  executive_summary: z.string(),
  diagnostics_summary: z.array(z.string()),
  methodology_assumptions: z.array(z.string()),
  recommendations: z.array(z.string()),
  export_ready: z.boolean(),
});
