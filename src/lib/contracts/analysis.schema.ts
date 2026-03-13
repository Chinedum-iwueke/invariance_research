import { z } from "zod";
import { figurePayloadSchema } from "@/lib/contracts/figures.schema";
import { reportPayloadSchema } from "@/lib/contracts/report.schema";

export const analysisStatusSchema = z.enum(["draft", "uploaded", "queued", "processing", "completed", "failed"]);

export const strategyMetadataSchema = z.object({
  strategy_name: z.string(),
  strategy_type: z.string().optional(),
  asset_class: z.string().optional(),
  symbols: z.array(z.string()),
  timeframe: z.string().optional(),
  direction: z.enum(["long", "short", "long_short"]).optional(),
  source_type: z.enum(["upload", "api", "manual"]),
  description: z.string().optional(),
});

export const datasetMetadataSchema = z.object({
  market: z.string().optional(),
  broker_or_exchange: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  trade_count: z.number(),
  bar_count: z.number().optional(),
  currency: z.string().optional(),
});

export const runContextSchema = z.object({
  execution_model: z.string(),
  monte_carlo: z.string(),
  risk_model: z.string(),
  notes: z.string().optional(),
});

export const scoreBandSchema = z.object({
  value: z.string(),
  band: z.enum(["excellent", "good", "moderate", "elevated", "critical", "informational"]),
  label: z.string(),
});

export const verdictSchema = z.object({
  status: z.enum(["robust", "moderate", "fragile"]),
  title: z.string(),
  summary: z.string(),
});

export const warningItemSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  message: z.string(),
});

export const interpretationBlockPayloadSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()).optional(),
});

export const overviewDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  figure: figurePayloadSchema,
  interpretation: interpretationBlockPayloadSchema,
  verdict: verdictSchema,
});

export const distributionDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  figures: z.array(figurePayloadSchema),
  interpretation: interpretationBlockPayloadSchema,
});

export const monteCarloDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  figure: figurePayloadSchema,
  interpretation: interpretationBlockPayloadSchema,
  warnings: z.array(warningItemSchema),
});

export const stabilityDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  figure: figurePayloadSchema.optional(),
  interpretation: interpretationBlockPayloadSchema,
  locked: z.boolean().optional(),
});

export const executionScenarioSchema = z.object({
  name: z.string(),
  assumption: z.string(),
  impact: z.string(),
});

export const executionDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  scenarios: z.array(executionScenarioSchema),
  figure: figurePayloadSchema.optional(),
  interpretation: interpretationBlockPayloadSchema,
});

export const regimeDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  figures: z.array(figurePayloadSchema).optional(),
  interpretation: interpretationBlockPayloadSchema,
  locked: z.boolean().optional(),
});

export const ruinAssumptionSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const ruinDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  assumptions: z.array(ruinAssumptionSchema),
  figure: figurePayloadSchema.optional(),
  interpretation: interpretationBlockPayloadSchema,
});

export const diagnosticBundleSchema = z.object({
  overview: overviewDiagnosticSchema,
  distribution: distributionDiagnosticSchema,
  monte_carlo: monteCarloDiagnosticSchema,
  stability: stabilityDiagnosticSchema,
  execution: executionDiagnosticSchema,
  regimes: regimeDiagnosticSchema,
  ruin: ruinDiagnosticSchema,
});

export const accessFlagsSchema = z.object({
  can_view_stability: z.boolean(),
  can_view_regimes: z.boolean(),
  can_view_ruin: z.boolean(),
  can_export_report: z.boolean(),
});

export const analysisSummarySchema = z.object({
  robustness_score: scoreBandSchema.optional(),
  overfitting_risk: scoreBandSchema.optional(),
  execution_resilience: scoreBandSchema.optional(),
  regime_dependence: scoreBandSchema.optional(),
  capital_survivability: scoreBandSchema.optional(),
  headline_verdict: verdictSchema,
  short_summary: z.string(),
  key_findings: z.array(z.string()),
  warnings: z.array(warningItemSchema),
});

export const analysisRecordSchema = z.object({
  analysis_id: z.string(),
  status: analysisStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  strategy: strategyMetadataSchema,
  dataset: datasetMetadataSchema,
  run_context: runContextSchema,
  summary: analysisSummarySchema,
  diagnostics: diagnosticBundleSchema,
  report: reportPayloadSchema,
  access: accessFlagsSchema,
});
