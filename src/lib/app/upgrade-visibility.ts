import type { DiagnosticAccessReason } from "../contracts/entitlements";

export function shouldShowDiagnosticUpgrade(reason: DiagnosticAccessReason): boolean {
  return reason === "plan_locked";
}

export function isQuotaExceeded(errorCode: string | null | undefined): boolean {
  return errorCode === "monthly_analysis_limit_reached";
}

export function isUploadPlanRestricted(errorCode: string | null | undefined): boolean {
  return errorCode === "plan_upload_locked";
}

export function isReportExportPlanRestricted(canExport: boolean): boolean {
  return !canExport;
}
