import { z } from "zod";
import { llmDiagnosticInsightsSchema } from "@/lib/contracts/analysis.schema";

const conciseString = z.string().min(1).max(900);
const conciseList = z.array(z.string().min(1).max(220)).max(5);

export const validationVerdictSchema = z.object({
  summary: conciseString,
  strengths: conciseList,
  weaknesses: conciseList,
  benchmark_context: conciseString,
  confidence_notes: conciseString,
});

export const deploymentReadinessAssessmentSchema = z.object({
  summary: conciseString,
  deployment_risk_level: z.enum(["low", "moderate", "high", "critical"]),
  readiness_status: z.enum(["not_advisable", "conditional", "advisable"]),
  strengths: conciseList,
  blockers: conciseList,
  next_experiments: conciseList,
  confidence_notes: conciseString,
});

export const recommendationBundleSchema = z.object({
  summary: conciseString,
  overview: conciseList,
  distribution: conciseList,
  monte_carlo: conciseList,
  execution: conciseList,
  ruin: conciseList,
  report: conciseList,
});

export const executionInterpretationSchema = z.object({
  summary: conciseString,
  execution_warnings: conciseList,
  fee_sensitivity: conciseString,
  fragility_signals: conciseList,
  next_experiments: conciseList,
});

export const distributionInterpretationSchema = z.object({
  summary: conciseString,
  strengths: conciseList,
  weaknesses: conciseList,
  fragility_signals: conciseList,
  next_experiments: conciseList,
});

export const monteCarloInterpretationSchema = z.object({
  summary: conciseString,
  fragility_signals: conciseList,
  regime_dependency: conciseString,
  next_experiments: conciseList,
  confidence_notes: conciseString,
});

export const riskOfRuinInterpretationSchema = z.object({
  summary: conciseString,
  fragility_signals: conciseList,
  deployment_risk_level: z.enum(["low", "moderate", "high", "critical"]),
  next_experiments: conciseList,
  confidence_notes: conciseString,
});

export const structuredInsightResponseSchema = z.object({
  validation_verdict: validationVerdictSchema,
  deployment_readiness_assessment: deploymentReadinessAssessmentSchema,
  recommendation_bundle: recommendationBundleSchema,
  execution_interpretation_detail: executionInterpretationSchema,
  distribution_interpretation_detail: distributionInterpretationSchema,
  monte_carlo_interpretation_detail: monteCarloInterpretationSchema,
  risk_of_ruin_interpretation: riskOfRuinInterpretationSchema,
});

export const llmInsightContractSchema = llmDiagnosticInsightsSchema.extend({
  validation_verdict: validationVerdictSchema.optional(),
  deployment_readiness_assessment: deploymentReadinessAssessmentSchema.optional(),
  recommendation_bundle: recommendationBundleSchema.optional(),
  execution_interpretation_detail: executionInterpretationSchema.optional(),
  distribution_interpretation_detail: distributionInterpretationSchema.optional(),
  monte_carlo_interpretation_detail: monteCarloInterpretationSchema.optional(),
  risk_of_ruin_interpretation: riskOfRuinInterpretationSchema.optional(),
});

export type StructuredInsightResponse = z.infer<typeof structuredInsightResponseSchema>;
export type LlmInsightContract = z.infer<typeof llmInsightContractSchema>;

export const ollamaStructuredInsightJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "validation_verdict",
    "deployment_readiness_assessment",
    "recommendation_bundle",
    "execution_interpretation_detail",
    "distribution_interpretation_detail",
    "monte_carlo_interpretation_detail",
    "risk_of_ruin_interpretation",
  ],
  properties: {
    validation_verdict: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "strengths", "weaknesses", "benchmark_context", "confidence_notes"],
      properties: {
        summary: { type: "string", maxLength: 900 },
        strengths: stringListSchema(),
        weaknesses: stringListSchema(),
        benchmark_context: { type: "string", maxLength: 900 },
        confidence_notes: { type: "string", maxLength: 900 },
      },
    },
    deployment_readiness_assessment: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "deployment_risk_level", "readiness_status", "strengths", "blockers", "next_experiments", "confidence_notes"],
      properties: {
        summary: { type: "string", maxLength: 900 },
        deployment_risk_level: { type: "string", enum: ["low", "moderate", "high", "critical"] },
        readiness_status: { type: "string", enum: ["not_advisable", "conditional", "advisable"] },
        strengths: stringListSchema(),
        blockers: stringListSchema(),
        next_experiments: stringListSchema(),
        confidence_notes: { type: "string", maxLength: 900 },
      },
    },
    recommendation_bundle: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "overview", "distribution", "monte_carlo", "execution", "ruin", "report"],
      properties: {
        summary: { type: "string", maxLength: 900 },
        overview: stringListSchema(),
        distribution: stringListSchema(),
        monte_carlo: stringListSchema(),
        execution: stringListSchema(),
        ruin: stringListSchema(),
        report: stringListSchema(),
      },
    },
    execution_interpretation_detail: interpretationSchema(["summary", "execution_warnings", "fee_sensitivity", "fragility_signals", "next_experiments"], {
      execution_warnings: stringListSchema(),
      fee_sensitivity: { type: "string", maxLength: 900 },
      fragility_signals: stringListSchema(),
      next_experiments: stringListSchema(),
    }),
    distribution_interpretation_detail: interpretationSchema(["summary", "strengths", "weaknesses", "fragility_signals", "next_experiments"], {
      strengths: stringListSchema(),
      weaknesses: stringListSchema(),
      fragility_signals: stringListSchema(),
      next_experiments: stringListSchema(),
    }),
    monte_carlo_interpretation_detail: interpretationSchema(["summary", "fragility_signals", "regime_dependency", "next_experiments", "confidence_notes"], {
      fragility_signals: stringListSchema(),
      regime_dependency: { type: "string", maxLength: 900 },
      next_experiments: stringListSchema(),
      confidence_notes: { type: "string", maxLength: 900 },
    }),
    risk_of_ruin_interpretation: interpretationSchema(["summary", "fragility_signals", "deployment_risk_level", "next_experiments", "confidence_notes"], {
      fragility_signals: stringListSchema(),
      deployment_risk_level: { type: "string", enum: ["low", "moderate", "high", "critical"] },
      next_experiments: stringListSchema(),
      confidence_notes: { type: "string", maxLength: 900 },
    }),
  },
} as const;

function stringListSchema() {
  return {
    type: "array",
    maxItems: 5,
    items: { type: "string", minLength: 1, maxLength: 220 },
  } as const;
}

function interpretationSchema(required: string[], properties: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties: {
      summary: { type: "string", maxLength: 900 },
      ...properties,
    },
  } as const;
}
