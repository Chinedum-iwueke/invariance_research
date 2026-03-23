import type {
  ArtifactRichness,
  DiagnosticEligibilityMatrix,
  DiagnosticName,
  UploadEligibilitySummary,
  ParsedArtifact,
} from "./contracts";

function allAvailableDiagnostics(): DiagnosticEligibilityMatrix {
  return {
    overview: { availability: "available" },
    distribution: { availability: "available" },
    monte_carlo: { availability: "available" },
    stability: { availability: "available" },
    execution: { availability: "available" },
    regimes: { availability: "available" },
    ruin: { availability: "available" },
    report: { availability: "available" },
  };
}

export function buildDiagnosticEligibility(
  richness: ArtifactRichness,
  context?: { assumptionsPresent?: boolean; ohlcvPresent?: boolean; paramsPresent?: boolean },
): DiagnosticEligibilityMatrix {
  if (richness === "research_complete") {
    return allAvailableDiagnostics();
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
      report: { availability: "available" },
    };
  }

  const regimesAvailable = Boolean(context?.ohlcvPresent);
  return {
    overview: { availability: "available" },
    distribution: { availability: "available" },
    monte_carlo: { availability: "available" },
    stability: { availability: context?.paramsPresent ? "available" : "limited", reason: context?.paramsPresent ? undefined : "requires parameter sweep bundle (multi-run parameter combinations with run mapping)" },
    execution: {
      availability: context?.assumptionsPresent ? "available" : "limited",
      reason: context?.assumptionsPresent ? undefined : "requires richer execution assumptions",
    },
    regimes: {
      availability: regimesAvailable ? "available" : "limited",
      reason: regimesAvailable ? undefined : "requires OHLCV or regime-labeled context",
    },
    ruin: { availability: "available" },
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
