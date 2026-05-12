import type { DiagnosticInsightContext } from "@/lib/server/llm/insight-service";
import { ollamaStructuredInsightJsonSchema } from "@/lib/server/llm/insight-schemas";

export const MAX_LLM_PROMPT_CHARS = 7 * 1024;

export function buildInsightPrompt(context: DiagnosticInsightContext): string {
  const instructions = [
    "You are an institutional validation analyst. You do not provide trading advice, alpha ideas, or profitability promises.",
    "Use the structured diagnostic context only. Never invent missing diagnostics, figures, benchmark coverage, parameters, OHLCV, or execution detail.",
    "Deterministic metrics, warnings, limitations, and recommendations are authoritative. Synthesize them without contradiction.",
    "Only recommend a benchmark when benchmark.configured is false. Only recommend parameter sweeps when stability diagnostics are unavailable. Only recommend OHLCV/regime labels when regime conditioning is unavailable.",
    "Use concise, professional language. Prefer specific risk, fragility, and next-experiment framing over generic advice.",
    "Return JSON only matching the provided schema.",
  ].join("\n");

  const compactPayload = JSON.stringify({
    output_schema: ollamaStructuredInsightJsonSchema,
    context: compactContext(context),
  });
  const prompt = `${instructions}\n\n${compactPayload}`;
  return prompt.length <= MAX_LLM_PROMPT_CHARS ? prompt : prompt.slice(0, MAX_LLM_PROMPT_CHARS);
}

function compactContext(context: DiagnosticInsightContext): DiagnosticInsightContext {
  return {
    ...context,
    deterministic_warnings: capList(context.deterministic_warnings, 5),
    deterministic_limitations: capList(context.deterministic_limitations, 6),
    deterministic_recommendations: {
      overview: capList(context.deterministic_recommendations.overview, 3),
      distribution: capList(context.deterministic_recommendations.distribution, 3),
      monte_carlo: capList(context.deterministic_recommendations.monte_carlo, 3),
      execution: capList(context.deterministic_recommendations.execution, 3),
      ruin: capList(context.deterministic_recommendations.ruin, 3),
      report: capList(context.deterministic_recommendations.report, 4),
    },
    available_diagnostics: capList(context.available_diagnostics, 8),
    missing_diagnostics: capList(context.missing_diagnostics, 8),
    known_limitations: capList(context.known_limitations, 8),
  };
}

function capList(items: string[], limit: number): string[] {
  return items.slice(0, limit).map((item) => item.length > 220 ? `${item.slice(0, 217)}...` : item);
}
