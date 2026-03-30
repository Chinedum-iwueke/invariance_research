import type { CreateAnalysisRequest } from "@/lib/contracts";
import { getBenchmarkManifest } from "@/lib/benchmarks/benchmark-library";
import { resolveBenchmark } from "@/lib/benchmarks/benchmark-resolver";
import type { DetectedAssetClass } from "@/lib/benchmarks/benchmark-types";
import type { AnalysisBenchmarkConfig, AnalysisBenchmarkSelectionInput } from "@/lib/analyses/analysis-types";
import type { ParsedArtifact } from "@/lib/server/ingestion";

export function parseBenchmarkSelectionFromRequest(payload: CreateAnalysisRequest): AnalysisBenchmarkSelectionInput {
  return {
    mode: payload.benchmark?.mode ?? "auto",
    requested_id: payload.benchmark?.requested_id ?? null,
  };
}

export async function buildPersistedBenchmarkConfig(input: {
  selection: AnalysisBenchmarkSelectionInput;
  parsedArtifact: ParsedArtifact;
}): Promise<AnalysisBenchmarkConfig> {
  const detectedAssetClass = detectAssetClass(input.parsedArtifact);
  const resolved = resolveBenchmark({
    mode: input.selection.mode,
    requestedId: input.selection.requested_id,
    detectedAssetClass,
  });
  if (!resolved.enabled) {
    return {
      mode: resolved.mode,
      requested_id: resolved.requestedId,
      resolved_id: resolved.resolvedId,
      resolution_reason: resolved.resolutionReason,
      source: null,
      frequency: null,
      library_revision: null,
      enabled: false,
    };
  }

  try {
    const manifest = await getBenchmarkManifest();

    return {
      mode: resolved.mode,
      requested_id: resolved.requestedId,
      resolved_id: resolved.resolvedId,
      resolution_reason: resolved.resolutionReason,
      source: "platform_managed",
      frequency: "1d",
      library_revision: manifest.revision,
      enabled: true,
    };
  } catch {
    return {
      mode: resolved.mode,
      requested_id: resolved.requestedId,
      resolved_id: resolved.resolvedId,
      resolution_reason: resolved.resolutionReason,
      source: "platform_managed",
      frequency: "1d",
      library_revision: null,
      enabled: true,
    };
  }
}

function detectAssetClass(parsedArtifact: ParsedArtifact): DetectedAssetClass {
  const values = [
    parsedArtifact.strategy_metadata?.tags?.join(" "),
    parsedArtifact.strategy_metadata?.description,
    parsedArtifact.strategy_metadata?.source_platform,
    parsedArtifact.trades[0]?.market,
    parsedArtifact.trades[0]?.symbol,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!values) return "unknown";
  if (values.includes("crypto") || values.includes("btc") || values.includes("eth")) return "crypto";
  if (values.includes("equity") || values.includes("stock") || values.includes("spy") || values.includes("nasdaq")) return "equities";
  if (values.includes("metal") || values.includes("gold") || values.includes("xau")) return "metals";
  if (values.includes("dxy") || values.includes("macro") || values.includes("rates")) return "macro";
  if (values.includes("fx") || values.includes("forex") || values.includes("usd") || values.includes("eur")) return "fx";
  return "unknown";
}
