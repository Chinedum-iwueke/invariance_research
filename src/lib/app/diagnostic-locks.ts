import type { DiagnosticAccessReason } from "../contracts/entitlements";

export type DiagnosticLockState = Exclude<DiagnosticAccessReason, "enabled">;
export type ArtifactRequirementProfile = "generic_context" | "parameter_sweep_bundle" | "execution_sensitivity" | "regime_analysis";

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
  artifactRequirementProfile?: ArtifactRequirementProfile;
}

export function buildDiagnosticLockModel(input: BuildDiagnosticLockModelInput): DiagnosticLockModel {
  const currentPlan = (input.currentPlan ?? "free").toLowerCase();
  const showUpgradeCta = ["free", "explorer", "individual", "professional", "pro", "research_lab"].includes(currentPlan);

  if (input.state === "artifact_unavailable") {
    if (input.artifactRequirementProfile === "execution_sensitivity") {
      return {
        diagnosticTitle: input.diagnosticTitle,
        diagnosticPurpose: input.diagnosticPurpose,
        state: input.state,
        badgeLabel: "Artifact Limited",
        primaryExplanation:
          "Execution Sensitivity baseline requires trade data plus explicit execution/cost assumptions. This run only includes partial execution context.",
        unlockRequirements: [
          "Baseline requires trade data and explicit execution/cost assumptions.",
          "Enhanced realism benefits from OHLCV, spread proxies, broker fills, and execution metadata.",
          "Broker-level execution realism requires fill, fee, spread, venue, and latency evidence; use Research Desk when those details are incomplete.",
        ],
        actions: [
          { label: "Upload execution assumptions", href: "/app/new-analysis", emphasis: "primary" },
          { label: "View supported bundle format", href: "/methodology", emphasis: "secondary" },
        ],
        footerNote: "OHLCV is optional for baseline execution sensitivity and improves realism when available.",
      };
    }

    if (input.artifactRequirementProfile === "parameter_sweep_bundle") {
      return {
        diagnosticTitle: input.diagnosticTitle,
        diagnosticPurpose: input.diagnosticPurpose,
        state: input.state,
        badgeLabel: "Artifact Limited",
        primaryExplanation:
          "True parameter stability is a Research Desk scope for launch. A parameter sweep bundle can improve the review packet, but automated upload diagnostics should not claim a validated stability surface.",
        unlockRequirements: [
          "Provide any available sweep outputs, parameter metadata, and run-to-parameter mapping as supporting evidence.",
          "Include comparable per-run results only if they were generated under the same evaluation rules.",
          "Use Research Desk to validate sweep design, fragile regions, and whether the supplied runs support a stability conclusion.",
        ],
        actions: [
          { label: "Request Research Desk", href: "/strategy-validation", emphasis: "primary" },
          { label: "View supported bundle format", href: "/docs/lab", emphasis: "secondary" },
        ],
        footerNote:
          "A single params file documents configuration only; it does not prove parameter stability.",
      };
    }

    if (input.artifactRequirementProfile === "regime_analysis") {
      return {
        diagnosticTitle: input.diagnosticTitle,
        diagnosticPurpose: input.diagnosticPurpose,
        state: input.state,
        badgeLabel: "Artifact Limited",
        primaryExplanation:
          "Regime attribution is a Research Desk scope for launch. Uploaded OHLCV can improve context, but automated upload diagnostics should not claim portfolio-level or multi-asset regime causality.",
        unlockRequirements: [
          "Provide OHLCV, symbol coverage, timezone, bar interval, and any explicit regime definitions as supporting evidence.",
          "For multi-asset strategies, include timestamp alignment and symbol-to-trade mapping so reviewers can inspect attribution quality.",
          "Use Research Desk to validate regime buckets, data alignment, and whether the supplied context supports a regime-dependence claim.",
        ],
        actions: [
          { label: "Request Research Desk", href: "/strategy-validation", emphasis: "primary" },
          { label: "View supported bundle format", href: "/docs/lab", emphasis: "secondary" },
        ],
        footerNote: "No automated regime result should be treated as decision-grade without explicit, auditable regime definitions and reviewer validation.",
      };
    }

    return {
      diagnosticTitle: input.diagnosticTitle,
      diagnosticPurpose: input.diagnosticPurpose,
      state: input.state,
      badgeLabel: "Artifact Limited",
      primaryExplanation:
        "Your current upload includes trade-level results only. This diagnostic requires additional structured context.",
      unlockRequirements: [
        "Upload a structured bundle that includes trade history.",
        "Include supporting metadata and assumptions context where available.",
        "Use manifest-backed bundle files so intake can verify artifact capability.",
      ],
      actions: [
        { label: "Upload structured artifact", href: "/app/new-analysis", emphasis: "primary" },
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
      "Request Research Desk review for high-stakes interpretation.",
        "Engine support may expand in future validated releases.",
      ],
      actions: [
        { label: "View supported diagnostics", href: "/app/analyses", emphasis: "primary" },
        { label: "Request Research Desk", href: "/contact", emphasis: "secondary" },
      ],
      footerNote: "This limitation is engine-based and does not require a plan upgrade.",
    };
  }

  return {
    diagnosticTitle: input.diagnosticTitle,
    diagnosticPurpose: input.diagnosticPurpose,
    state: input.state,
    badgeLabel: "Plan Locked",
    primaryExplanation: `This diagnostic is available on the ${input.requiredPlan ?? "Individual"} plan and above.${input.artifactRequirementProfile ? " It also requires specific structured artifact inputs." : ""}`,
    unlockRequirements: [
      `Current plan: ${input.currentPlan ?? "Free"}`,
      `Required plan: ${input.requiredPlan ?? "Individual"}`,
      ...(input.artifactRequirementProfile === "parameter_sweep_bundle"
        ? ["Artifact requirement: parameter sweep bundle with run-to-parameter mapping."]
        : input.artifactRequirementProfile === "regime_analysis"
          ? ["Artifact requirement: OHLCV or equivalent market context to classify regimes."]
          : []),
      "Upgrade unlocks deeper diagnostics and workflow capacity for this surface.",
    ],
    actions: [
      ...(showUpgradeCta ? [{ label: `Upgrade to ${input.requiredPlan ?? "Individual"}`, href: "/app/upgrade", emphasis: "primary" as const }] : []),
      { label: "Request Strategy Validation", href: "/strategy-validation", emphasis: "secondary" },
    ],
    footerNote: showUpgradeCta
      ? "This diagnostic is plan-gated and artifact-dependent."
      : "Artifact requirements still apply even when your plan is already entitled.",
  };
}
