import type { DiagnosticAccessReason } from "@/lib/contracts/entitlements";
import type { ParsedArtifact } from "@/lib/server/ingestion";
import { accountService } from "@/lib/server/accounts/service";
import { logger } from "@/lib/server/ops/logger";

export type DiagnosticKey = "overview" | "distribution" | "monte_carlo" | "ruin" | "execution" | "regimes" | "stability";

function artifactSupports(parsed: ParsedArtifact | undefined, diagnostic: DiagnosticKey): boolean {
  if (!parsed) return false;
  if (diagnostic === "overview" || diagnostic === "distribution" || diagnostic === "monte_carlo") return true;
  if (diagnostic === "ruin" || diagnostic === "execution") return true;
  if (diagnostic === "regimes") return parsed.richness === "trade_plus_context" || parsed.richness === "research_complete";
  if (diagnostic === "stability") return parsed.richness === "research_complete";
  return false;
}

function engineSupports(parsed: ParsedArtifact | undefined, diagnostic: DiagnosticKey): boolean {
  if (!parsed) return false;
  if (diagnostic === "stability") return parsed.richness === "research_complete";
  if (diagnostic === "regimes") return parsed.richness !== "trade_only";
  return true;
}

function isPlanEntitled(accountId: string, diagnostic: DiagnosticKey): boolean {
  const state = accountService.getAccountState(accountId);
  if (!state) return false;
  if (diagnostic === "overview") return state.entitlements.can_view_overview;
  if (diagnostic === "distribution") return state.entitlements.can_view_distribution;
  if (diagnostic === "monte_carlo") return state.entitlements.can_view_monte_carlo;
  if (diagnostic === "ruin") return state.entitlements.can_view_ruin;
  if (diagnostic === "execution") return state.entitlements.can_view_execution;
  if (diagnostic === "regimes") return state.entitlements.can_view_regimes;
  return state.entitlements.can_view_stability;
}

export function resolveDiagnosticAccess(input: {
  account_id: string;
  diagnostic: DiagnosticKey;
  parsed_artifact?: ParsedArtifact;
  is_admin?: boolean;
}): { allowed: boolean; reason: DiagnosticAccessReason; message: string } {
  if (!artifactSupports(input.parsed_artifact, input.diagnostic)) {
    return { allowed: false, reason: "artifact_unavailable", message: "This diagnostic requires richer artifact context." };
  }

  if (!engineSupports(input.parsed_artifact, input.diagnostic)) {
    return { allowed: false, reason: "engine_unavailable", message: "The current engine cannot compute this diagnostic credibly." };
  }

  if (!input.is_admin && !isPlanEntitled(input.account_id, input.diagnostic)) {
    return { allowed: false, reason: "plan_locked", message: "Available on a higher plan." };
  }

  return { allowed: true, reason: "enabled", message: "Enabled." };
}

export function assertUploadAllowed(accountId: string, artifactClass: "trade_csv" | "structured_bundle" | "research_bundle") {
  const state = accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");

  if (artifactClass === "trade_csv" && !state.entitlements.can_upload_trade_csv) throw new Error("upload_not_allowed");
  if (artifactClass === "structured_bundle" && !state.entitlements.can_upload_bundle) throw new Error("upload_not_allowed");
  if (artifactClass === "research_bundle" && !state.entitlements.can_upload_research_bundle) throw new Error("upload_not_allowed");
}


export function assertExportAllowed(accountId: string, isAdmin = false) {
  if (isAdmin) return;
  const state = accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  if (!state.entitlements.can_export_report) {
    logger.warn("export.denied", { account_id: accountId, reason: "plan_restricted" });
    throw new Error("report_export_plan_restricted");
  }
}
