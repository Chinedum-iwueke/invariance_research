import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { DetectedAssetClass, ResolvedBenchmark } from "@/lib/benchmarks/benchmark-types";

type ResolveBenchmarkInput = {
  mode: "auto" | "manual" | "none";
  requestedId?: BenchmarkId | null;
  detectedAssetClass?: DetectedAssetClass;
};

export function resolveBenchmark(input: ResolveBenchmarkInput): ResolvedBenchmark {
  const requestedId = input.requestedId ?? null;

  if (input.mode === "none") {
    return {
      enabled: false,
      mode: "none",
      requestedId,
      resolvedId: null,
      resolutionReason: "user_selected_none",
    };
  }

  if (input.mode === "manual") {
    return {
      enabled: requestedId !== null,
      mode: "manual",
      requestedId,
      resolvedId: requestedId,
      resolutionReason: "user_selected_manual",
    };
  }

  const detectedAssetClass = input.detectedAssetClass ?? "unknown";

  const autoMap: Record<Exclude<DetectedAssetClass, "unknown">, { resolvedId: BenchmarkId; reason: ResolvedBenchmark["resolutionReason"] }> = {
    crypto: { resolvedId: "BTC", reason: "detected_asset_class_crypto" },
    equities: { resolvedId: "SPY", reason: "detected_asset_class_equities" },
    metals: { resolvedId: "XAUUSD", reason: "detected_asset_class_metals" },
    macro: { resolvedId: "DXY", reason: "detected_asset_class_macro" },
    fx: { resolvedId: "DXY", reason: "detected_asset_class_macro" },
  };

  if (detectedAssetClass === "unknown") {
    return {
      enabled: false,
      mode: "auto",
      requestedId: null,
      resolvedId: null,
      resolutionReason: "low_confidence_unknown",
    };
  }

  const resolved = autoMap[detectedAssetClass];
  return {
    enabled: true,
    mode: "auto",
    requestedId: null,
    resolvedId: resolved.resolvedId,
    resolutionReason: resolved.reason,
  };
}
