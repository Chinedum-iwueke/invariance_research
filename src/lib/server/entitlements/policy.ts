import type { DiagnosticAccessReason } from "@/lib/contracts/entitlements";
import { toUploadEligibilitySummary, type ParsedArtifact } from "@/lib/server/ingestion";
import { accountService } from "@/lib/server/accounts/service";
import { buildEvidenceLedger, overlayEvidenceEntitlements, type EvidenceLedgerEntry } from "@/lib/server/evidence/evidence-ledger-service";
import { logger } from "@/lib/server/ops/logger";

export type DiagnosticKey = "overview" | "distribution" | "monte_carlo" | "ruin" | "prop_evaluation_readiness" | "execution" | "regimes" | "stability";

async function isPlanEntitled(accountId: string, diagnostic: DiagnosticKey): Promise<boolean> {
  const state = await accountService.getAccountState(accountId);
  if (!state) return false;
  if (diagnostic === "overview") return state.entitlements.can_view_overview;
  if (diagnostic === "distribution") return state.entitlements.can_view_distribution;
  if (diagnostic === "monte_carlo") return state.entitlements.can_view_monte_carlo;
  if (diagnostic === "ruin") return state.entitlements.can_view_ruin;
  if (diagnostic === "prop_evaluation_readiness") return state.entitlements.can_view_prop_evaluation;
  if (diagnostic === "execution") return state.entitlements.can_view_execution;
  if (diagnostic === "regimes") return state.entitlements.can_view_regimes;
  return state.entitlements.can_view_stability;
}

export async function resolveDiagnosticAccess(input: {
  account_id: string;
  diagnostic: DiagnosticKey;
  parsed_artifact?: ParsedArtifact;
  is_admin?: boolean;
}): Promise<{ allowed: boolean; reason: DiagnosticAccessReason; message: string }> {
  if (input.is_admin) {
    return { allowed: true, reason: "enabled", message: "Enabled for admin testing." };
  }

  const evidenceEntry = input.parsed_artifact ? buildAccessEvidenceEntry(input.parsed_artifact, input.diagnostic) : undefined;

  if (!evidenceEntry || evidenceEntry.artifact_status === "unavailable") {
    return {
      allowed: false,
      reason: "artifact_unavailable",
      message: evidenceEntry?.artifact_reason ?? "This diagnostic requires richer artifact context.",
    };
  }

  if (evidenceEntry.engine_status === "unavailable" || evidenceEntry.final_status === "skipped") {
    return {
      allowed: false,
      reason: "engine_unavailable",
      message: evidenceEntry.engine_reason ?? "The current engine cannot compute this diagnostic credibly.",
    };
  }

  const planEntitled = await isPlanEntitled(input.account_id, input.diagnostic);
  if (!planEntitled) {
    return { allowed: false, reason: "plan_locked", message: "Available on a higher plan." };
  }

  return { allowed: true, reason: "enabled", message: "Enabled." };
}

function buildAccessEvidenceEntry(parsedArtifact: ParsedArtifact, diagnostic: DiagnosticKey): EvidenceLedgerEntry {
  const ledger = buildEvidenceLedger({ eligibility: toUploadEligibilitySummary(parsedArtifact) });
  const projected = overlayEvidenceEntitlements(ledger, { [diagnostic]: true });
  return projected.by_diagnostic[diagnostic];
}

export async function assertUploadAllowed(accountId: string, artifactClass: "trade_csv" | "structured_bundle" | "research_bundle") {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");

  if (artifactClass === "trade_csv" && !state.entitlements.can_upload_trade_csv) throw new Error("upload_not_allowed");
  if (artifactClass === "structured_bundle" && !state.entitlements.can_upload_bundle) throw new Error("upload_not_allowed");
  if (artifactClass === "research_bundle" && !state.entitlements.can_upload_research_bundle) throw new Error("upload_not_allowed");
}


export async function assertExportAllowed(accountId: string, isAdmin = false) {
  if (isAdmin) return;
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  if (!state.entitlements.can_export_report) {
    logger.warn("export.denied", { account_id: accountId, reason: "plan_restricted" });
    throw new Error("report_export_plan_restricted");
  }
}
