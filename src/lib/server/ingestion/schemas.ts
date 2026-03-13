import { z } from "zod";

import {
  ARTIFACT_KINDS,
  ARTIFACT_RICHNESS_VALUES,
  ARTIFACT_TYPES,
  DIAGNOSTICS,
  DIAGNOSTIC_AVAILABILITY_VALUES,
  PARSER_ADAPTER_KINDS,
  VALIDATION_ERROR_CODES,
} from "./contracts";

export const canonicalTradeSchema = z
  .object({
    symbol: z.string().min(1),
    side: z.enum(["long", "short"]),
    entry_time: z.string().datetime({ offset: true }),
    exit_time: z.string().datetime({ offset: true }),
    entry_price: z.number().finite().nonnegative(),
    exit_price: z.number().finite().nonnegative(),
    quantity: z.number().finite().positive(),
    trade_id: z.string().min(1).optional(),
    fees: z.number().finite().optional(),
    pnl: z.number().finite().optional(),
    pnl_pct: z.number().finite().optional(),
    mae: z.number().finite().optional(),
    mfe: z.number().finite().optional(),
    duration_seconds: z.number().int().nonnegative().optional(),
    strategy_name: z.string().min(1).optional(),
    timeframe: z.string().min(1).optional(),
    market: z.string().min(1).optional(),
    exchange: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
    entry_reason: z.string().min(1).optional(),
    exit_reason: z.string().min(1).optional(),
    risk_r: z.number().finite().optional(),
  })
  .superRefine((trade, ctx) => {
    const entry = new Date(trade.entry_time).getTime();
    const exit = new Date(trade.exit_time).getTime();

    if (entry >= exit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "entry_time must be earlier than exit_time",
        path: ["entry_time"],
      });
    }
  });

export const bundleManifestV1Schema = z.object({
  schema_version: z.literal("1.0"),
  artifact_type: z.enum(ARTIFACT_TYPES),
  strategy_name: z.string().min(1).optional(),
  source_platform: z.string().min(1).optional(),
  symbols: z.array(z.string().min(1)).optional(),
  timeframe: z.string().min(1).optional(),
  market: z.string().min(1).optional(),
  exchange: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  included_files: z.array(z.string().min(1)).min(1),
  assumptions_present: z.boolean().optional(),
  ohlcv_present: z.boolean().optional(),
  parameter_metadata_present: z.boolean().optional(),
});

export const bundleMetadataSchema = z.object({
  strategy_name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  source_platform: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const bundleAssumptionsSchema = z.object({
  slippage_model: z.string().min(1).optional(),
  commission_model: z.string().min(1).optional(),
  market_impact_model: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export const bundleParamsSchema = z.object({
  parameter_set_name: z.string().min(1).optional(),
  tunable_parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  optimization_target: z.string().min(1).optional(),
});

export const artifactValidationErrorSchema = z.object({
  code: z.enum(VALIDATION_ERROR_CODES),
  message: z.string().min(1),
  field: z.string().optional(),
  row: z.number().int().positive().optional(),
});

export const artifactValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(artifactValidationErrorSchema),
  warnings: z.array(z.string()),
});

export const diagnosticStatusSchema = z.object({
  availability: z.enum(DIAGNOSTIC_AVAILABILITY_VALUES),
  reason: z.string().optional(),
});

export const diagnosticEligibilityMatrixSchema = z.object(
  Object.fromEntries(
    DIAGNOSTICS.map((diagnostic) => [diagnostic, diagnosticStatusSchema]),
  ) as Record<(typeof DIAGNOSTICS)[number], typeof diagnosticStatusSchema>,
);

export const parsedArtifactSchema = z.object({
  artifact_kind: z.enum(ARTIFACT_KINDS),
  artifact_type: z.union([z.enum(ARTIFACT_TYPES), z.literal("trade_csv")]),
  richness: z.enum(ARTIFACT_RICHNESS_VALUES),
  strategy_metadata: bundleMetadataSchema.optional(),
  trades: z.array(canonicalTradeSchema),
  equity_curve: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  assumptions: bundleAssumptionsSchema.optional(),
  params: bundleParamsSchema.optional(),
  ohlcv_present: z.boolean(),
  benchmark_present: z.boolean(),
  diagnostic_eligibility: diagnosticEligibilityMatrixSchema,
  parser_notes: z.array(z.string()).optional(),
  validation: artifactValidationResultSchema,
});

export const uploadEligibilitySummarySchema = z.object({
  accepted: z.boolean(),
  detected_artifact_type: z.union([z.enum(ARTIFACT_TYPES), z.literal("trade_csv")]),
  detected_richness: z.enum(ARTIFACT_RICHNESS_VALUES),
  diagnostics_available: z.array(z.enum(DIAGNOSTICS)),
  diagnostics_limited: z.array(z.enum(DIAGNOSTICS)),
  diagnostics_unavailable: z.array(z.enum(DIAGNOSTICS)),
  limitation_reasons: z.array(z.string().min(1)),
  parser_notes: z.array(z.string()),
  summary_text: z.string().min(1),
});

export const parserAdapterKindSchema = z.enum(PARSER_ADAPTER_KINDS);
