import type {
  ArtifactRichness,
  DiagnosticEligibilityMatrix,
  DiagnosticName,
  UploadEligibilitySummary,
  ParsedArtifact,
} from "./contracts";

export function buildDiagnosticEligibility(
  richness: ArtifactRichness,
  context?: { assumptionsPresent?: boolean; ohlcvPresent?: boolean; paramsPresent?: boolean; parameterSweepPresent?: boolean },
): DiagnosticEligibilityMatrix {
  if (richness === "research_complete") {
    return {
      overview: { availability: "available" },
      distribution: { availability: "available" },
      monte_carlo: { availability: "available" },
      stability: {
        availability: context?.parameterSweepPresent ? "available" : "limited",
        reason: context?.parameterSweepPresent
          ? undefined
          : "params.json improves parameter context, but true parameter stability requires a multi-run parameter sweep with run-to-parameter mapping or Research Desk review",
      },
      execution: {
        availability: context?.assumptionsPresent ? "available" : "limited",
        reason: context?.assumptionsPresent ? undefined : "requires explicit execution/cost assumptions",
      },
      regimes: {
        availability: context?.ohlcvPresent ? "available" : "limited",
        reason: context?.ohlcvPresent
          ? "upload OHLCV supports regime context; portfolio-level multi-asset attribution still requires explicit coverage/alignment and may require Research Desk review"
          : "requires OHLCV or explicit regime-labeled context",
      },
      ruin: { availability: "available" },
      prop_evaluation_readiness: { availability: "available" },
      report: { availability: "available" },
    };
  }

  if (richness === "trade_only") {
    return {
      overview: { availability: "available" },
      distribution: { availability: "available" },
      monte_carlo: { availability: "available" },
      stability: { availability: "unavailable", reason: "requires parameter sweep bundle (multi-run parameter combinations with run mapping)" },
      execution: { availability: "limited", reason: "requires richer execution assumptions" },
      regimes: { availability: "unavailable", reason: "requires OHLCV or regime-labeled context" },
      ruin: { availability: "available" },
      prop_evaluation_readiness: { availability: "limited", reason: "uses fallback evaluation rules unless the user supplies exact prop firm constraints" },
      report: { availability: "available" },
    };
  }

  if (richness === "trade_plus_metadata") {
    return {
      overview: { availability: "available" },
      distribution: { availability: "available" },
      monte_carlo: { availability: "available" },
      stability: { availability: "unavailable", reason: "requires parameter sweep bundle (multi-run parameter combinations with run mapping)" },
      execution: { availability: "limited", reason: "requires richer execution assumptions" },
      regimes: { availability: "limited", reason: "requires market-context artifact" },
      ruin: { availability: "available" },
      prop_evaluation_readiness: { availability: "limited", reason: "daily-loss precision improves with exact prop rules and intraday/broker equity evidence" },
      report: { availability: "available" },
    };
  }

  const regimesAvailable = Boolean(context?.ohlcvPresent);
  return {
    overview: { availability: "available" },
    distribution: { availability: "available" },
    monte_carlo: { availability: "available" },
    stability: {
      availability: context?.parameterSweepPresent ? "available" : "limited",
      reason: context?.parameterSweepPresent
        ? undefined
        : context?.paramsPresent
          ? "params.json improves parameter context, but true parameter stability requires a multi-run parameter sweep with run-to-parameter mapping or Research Desk review"
          : "requires parameter sweep bundle (multi-run parameter combinations with run mapping)",
    },
    execution: {
      availability: context?.assumptionsPresent ? "available" : "limited",
      reason: context?.assumptionsPresent ? undefined : "requires richer execution assumptions",
    },
    regimes: {
      availability: regimesAvailable ? "available" : "limited",
      reason: regimesAvailable ? undefined : "requires OHLCV or regime-labeled context",
    },
    ruin: { availability: "available" },
    prop_evaluation_readiness: { availability: context?.assumptionsPresent ? "available" : "limited", reason: context?.assumptionsPresent ? undefined : "uses fallback evaluation rules unless exact rules are supplied" },
    report: { availability: "available" },
  };
}

export function toUploadEligibilitySummary(parsed: ParsedArtifact): UploadEligibilitySummary {
  const diagnosticsAvailable: DiagnosticName[] = [];
  const diagnosticsLimited: DiagnosticName[] = [];
  const diagnosticsUnavailable: DiagnosticName[] = [];

  Object.entries(parsed.diagnostic_eligibility).forEach(([name, status]) => {
    if (status.availability === "available") diagnosticsAvailable.push(name as DiagnosticName);
    if (status.availability === "limited") diagnosticsLimited.push(name as DiagnosticName);
    if (status.availability === "unavailable") diagnosticsUnavailable.push(name as DiagnosticName);
  });

  const limitationReasons = Object.values(parsed.diagnostic_eligibility)
    .map((status) => status.reason)
    .filter((reason): reason is string => Boolean(reason));

  const summaryText = [
    diagnosticsAvailable.length
      ? `${diagnosticsAvailable.join(", ")} are available for this upload.`
      : "No diagnostics are currently available for this upload.",
    diagnosticsLimited.length
      ? `${diagnosticsLimited.join(", ")} are limited due to incomplete context.`
      : undefined,
    diagnosticsUnavailable.length
      ? `${diagnosticsUnavailable.join(", ")} are unavailable based on artifact richness.`
      : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  return {
    accepted: parsed.validation.valid,
    detected_artifact_type: parsed.artifact_type,
    detected_richness: parsed.richness,
    diagnostics_available: diagnosticsAvailable,
    diagnostics_limited: diagnosticsLimited,
    diagnostics_unavailable: diagnosticsUnavailable,
    limitation_reasons: Array.from(new Set(limitationReasons)),
    parser_notes: parsed.parser_notes ?? [],
    summary_text: summaryText,
  };
}
