import type { DiagnosticAccessReason } from "../contracts/entitlements";

export type DiagnosticLockState = Exclude<DiagnosticAccessReason, "enabled">;

export interface DiagnosticLockAction {
  label: string;
  href: string;
  emphasis: "primary" | "secondary";
}

export interface DiagnosticLockModel {
  diagnosticTitle: string;
  diagnosticPurpose: string;
  state: DiagnosticLockState;
  badgeLabel: "Artifact Limited" | "Engine Limited" | "Plan Locked";
  primaryExplanation: string;
  unlockRequirements: string[];
  actions: DiagnosticLockAction[];
  footerNote: string;
}

interface BuildDiagnosticLockModelInput {
  state: DiagnosticLockState;
  diagnosticTitle: string;
  diagnosticPurpose: string;
  currentPlan?: string;
  requiredPlan?: string;
}

export function buildDiagnosticLockModel(input: BuildDiagnosticLockModelInput): DiagnosticLockModel {
  if (input.state === "artifact_unavailable") {
    return {
      diagnosticTitle: input.diagnosticTitle,
      diagnosticPurpose: input.diagnosticPurpose,
      state: input.state,
      badgeLabel: "Artifact Limited",
      primaryExplanation:
        "Your current upload includes trade-level results only. This diagnostic requires richer market or parameter context.",
      unlockRequirements: [
        "Upload a structured bundle that includes trade history.",
        "Include OHLCV or market-context series where available.",
        "Include parameter metadata and assumptions context.",
      ],
      actions: [
        { label: "Upload richer artifact", href: "/app/new-analysis", emphasis: "primary" },
        { label: "View supported bundle format", href: "/methodology", emphasis: "secondary" },
      ],
      footerNote: "This limitation is artifact-based and not related to plan access.",
    };
  }

  if (input.state === "engine_unavailable") {
    return {
      diagnosticTitle: input.diagnosticTitle,
      diagnosticPurpose: input.diagnosticPurpose,
      state: input.state,
      badgeLabel: "Engine Limited",
      primaryExplanation:
        "The current engine release cannot yet compute this diagnostic credibly from the available context.",
      unlockRequirements: [
        "Use currently supported diagnostics for this artifact.",
        "Request advisory review for high-stakes interpretation.",
        "Engine support may expand in future validated releases.",
      ],
      actions: [
        { label: "View supported diagnostics", href: "/app/analyses", emphasis: "primary" },
        { label: "Request strategy audit", href: "/contact", emphasis: "secondary" },
      ],
      footerNote: "This limitation is engine-based and does not require a plan upgrade.",
    };
  }

  return {
    diagnosticTitle: input.diagnosticTitle,
    diagnosticPurpose: input.diagnosticPurpose,
    state: input.state,
    badgeLabel: "Plan Locked",
    primaryExplanation: `This diagnostic is available on the ${input.requiredPlan ?? "Professional"} plan and above.`,
    unlockRequirements: [
      `Current plan: ${input.currentPlan ?? "Explorer"}`,
      `Required plan: ${input.requiredPlan ?? "Professional"}`,
      "Upgrade unlocks deeper diagnostics and workflow capacity for this surface.",
    ],
    actions: [
      { label: `Upgrade to ${input.requiredPlan ?? "Professional"}`, href: "/app/upgrade", emphasis: "primary" },
      { label: "Compare plans", href: "/app/billing", emphasis: "secondary" },
    ],
    footerNote: "This limitation is entitlement-based and can be unlocked by plan change.",
  };
}
