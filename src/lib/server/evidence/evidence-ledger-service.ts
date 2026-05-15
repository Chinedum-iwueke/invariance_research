import {
  DIAGNOSTICS,
  type DiagnosticName,
  type DiagnosticStatus,
  type UploadEligibilitySummary,
} from "@/lib/server/ingestion";
import type { EngineCapabilityProfile, EngineDiagnosticStatus } from "@/lib/server/engine/engine-types";

export type EvidenceLedgerStatus = "available" | "limited" | "unavailable" | "skipped" | "locked";
export type EvidenceSourceStatus = Exclude<EvidenceLedgerStatus, "locked">;

export type EvidenceLedgerEntry = {
  diagnostic: DiagnosticName;
  artifact_status: EvidenceSourceStatus;
  engine_status: EvidenceSourceStatus;
  final_status: EvidenceSourceStatus;
  entitlement_status?: "enabled" | "locked";
  display_status: EvidenceLedgerStatus;
  artifact_reason?: string;
  engine_reason?: string;
  entitlement_reason?: string;
  required_inputs: string[];
  optional_enrichments: string[];
};

export type EvidenceLedger = {
  diagnostics: EvidenceLedgerEntry[];
  by_diagnostic: Record<DiagnosticName, EvidenceLedgerEntry>;
  warnings: string[];
};

const KNOWN_DIAGNOSTICS = new Set<string>(DIAGNOSTICS);

export function isKnownDiagnosticName(value: string): value is DiagnosticName {
  return KNOWN_DIAGNOSTICS.has(value);
}

export function buildEvidenceLedger(input: {
  eligibility: UploadEligibilitySummary;
  capabilityProfile?: EngineCapabilityProfile;
}): EvidenceLedger {
  const warnings: string[] = [];

  if (input.capabilityProfile) {
    for (const diagnostic of Object.keys(input.capabilityProfile)) {
      if (!isKnownDiagnosticName(diagnostic)) {
        warnings.push(`Unknown engine diagnostic ignored: ${diagnostic}`);
      }
    }
  }

  const diagnostics = DIAGNOSTICS.map((diagnostic) => {
    const artifactStatus = artifactStatusFor(input.eligibility, diagnostic);
    const artifactAvailability = artifactStatus.availability;
    const engineCapability = input.capabilityProfile?.[diagnostic];
    const engineStatus = normalizeEngineStatus(engineCapability?.status);
    const finalStatus = mergeEvidenceStatuses(artifactAvailability, engineStatus);

    return {
      diagnostic,
      artifact_status: artifactAvailability,
      engine_status: engineStatus,
      final_status: finalStatus,
      display_status: finalStatus,
      artifact_reason: artifactStatus.reason,
      engine_reason: engineCapability?.reason,
      required_inputs: readStringList(engineCapability, "required_inputs"),
      optional_enrichments: readStringList(engineCapability, "optional_enrichments"),
    } satisfies EvidenceLedgerEntry;
  });

  return { diagnostics, by_diagnostic: indexLedger(diagnostics), warnings };
}

export function buildUploadEvidenceProjection(eligibility: UploadEligibilitySummary): EvidenceLedger {
  return buildEvidenceLedger({ eligibility });
}

export function overlayEvidenceEntitlements(
  ledger: EvidenceLedger,
  entitlements: Partial<Record<DiagnosticName, boolean>>,
): EvidenceLedger {
  const diagnostics = ledger.diagnostics.map((entry) => {
    const entitled = entitlements[entry.diagnostic] ?? true;
    return {
      ...entry,
      entitlement_status: entitled ? "enabled" : "locked",
      display_status: entitled ? entry.final_status : "locked",
      entitlement_reason: entitled ? undefined : "Available on a higher plan.",
    } satisfies EvidenceLedgerEntry;
  });

  return { diagnostics, by_diagnostic: indexLedger(diagnostics), warnings: [...ledger.warnings] };
}

export function reconcileDiagnosticStatus(
  eligibility: UploadEligibilitySummary,
  capabilityProfile?: EngineCapabilityProfile,
): Map<DiagnosticName, EvidenceSourceStatus> {
  const ledger = buildEvidenceLedger({ eligibility, capabilityProfile });
  return new Map(ledger.diagnostics.map((entry) => [entry.diagnostic, entry.final_status]));
}

function artifactStatusFor(eligibility: UploadEligibilitySummary, diagnostic: DiagnosticName): DiagnosticStatus {
  if (eligibility.diagnostics_available.includes(diagnostic)) return { availability: "available" };
  if (eligibility.diagnostics_limited.includes(diagnostic)) {
    return { availability: "limited", reason: firstMatchingLimitation(eligibility, diagnostic) };
  }
  return { availability: "unavailable", reason: firstMatchingLimitation(eligibility, diagnostic) };
}

function normalizeEngineStatus(status: EngineDiagnosticStatus | undefined): EvidenceSourceStatus {
  if (status === undefined) return "available";
  if (status === "supported") return "available";
  if (status === "available" || status === "limited" || status === "skipped") return status;
  return "unavailable";
}

function mergeEvidenceStatuses(artifactStatus: EvidenceSourceStatus, engineStatus: EvidenceSourceStatus): EvidenceSourceStatus {
  if (artifactStatus === "unavailable" || engineStatus === "unavailable") return "unavailable";
  if (artifactStatus === "skipped" || engineStatus === "skipped") return "skipped";
  if (artifactStatus === "limited" || engineStatus === "limited") return "limited";
  return "available";
}

function firstMatchingLimitation(eligibility: UploadEligibilitySummary, diagnostic: DiagnosticName): string | undefined {
  const needle = diagnostic.replace("_", " ");
  return eligibility.limitation_reasons.find((reason) => reason.toLowerCase().includes(needle))
    ?? eligibility.limitation_reasons[0];
}

function readStringList(source: unknown, key: "required_inputs" | "optional_enrichments"): string[] {
  if (!source || typeof source !== "object" || !Array.isArray((source as Record<string, unknown>)[key])) return [];
  return ((source as Record<string, unknown>)[key] as unknown[]).filter((item): item is string => typeof item === "string");
}

function indexLedger(entries: EvidenceLedgerEntry[]): Record<DiagnosticName, EvidenceLedgerEntry> {
  return Object.fromEntries(entries.map((entry) => [entry.diagnostic, entry])) as Record<DiagnosticName, EvidenceLedgerEntry>;
}
