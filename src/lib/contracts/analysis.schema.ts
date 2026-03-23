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
  positives: z.array(z.string()).optional(),
  cautions: z.array(z.string()).optional(),
  caveats: z.array(z.string()).optional(),
  key_caveats: z.array(z.string()).optional(),
  narrative: z.string().optional(),
  interpretation: z.string().optional(),
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
  spread: z.string().optional(),
  slippage: z.string().optional(),
  fee: z.string().optional(),
  expectancy: z.string().optional(),
  edge_decay_pct: z.string().optional(),
  classification: z.enum(["survives", "fragile", "negative", "informational"]).optional(),
});

export const executionDiagnosticSchema = z.object({
  metrics: z.array(scoreBandSchema),
  scenarios: z.array(executionScenarioSchema),
  figure: figurePayloadSchema.optional(),
  interpretation: interpretationBlockPayloadSchema,
  assumptions: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  execution_model: z.string().optional(),
  stress_realism: z.string().optional(),
  artifact_completeness: z.string().optional(),
  sensitivity_classification: z.enum(["resilient", "fragile", "cost_killed", "informational"]).optional(),
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

export const engineDiagnosticMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  numeric_value: z.number().optional(),
  band: z.enum(["excellent", "good", "moderate", "elevated", "critical", "informational"]).optional(),
});

export const engineDiagnosticEnvelopeSchema = z.object({
  status: z.enum(["available", "limited", "unavailable", "skipped"]).optional(),
  summary_metrics: z.array(engineDiagnosticMetricSchema),
  figures: z.array(figurePayloadSchema),
  interpretation: z.string().optional(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  limitations: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const enginePayloadSnapshotSchema = z.object({
  summary_metrics: z.array(engineDiagnosticMetricSchema),
  diagnostics: z
    .object({
      overview: engineDiagnosticEnvelopeSchema.optional(),
      distribution: engineDiagnosticEnvelopeSchema.optional(),
      monte_carlo: engineDiagnosticEnvelopeSchema.optional(),
      stability: engineDiagnosticEnvelopeSchema.optional(),
      execution: engineDiagnosticEnvelopeSchema.optional(),
      regimes: engineDiagnosticEnvelopeSchema.optional(),
      ruin: engineDiagnosticEnvelopeSchema.optional(),
      report: engineDiagnosticEnvelopeSchema.optional(),
    })
    .partial(),
  report_sections: z.object({
    assumptions: z.array(z.string()),
    limitations: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  raw_result: z.record(z.string(), z.unknown()),
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
  engine_payload: enginePayloadSnapshotSchema,
  report: reportPayloadSchema,
  access: accessFlagsSchema,
});
