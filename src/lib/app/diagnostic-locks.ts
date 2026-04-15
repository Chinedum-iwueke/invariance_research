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
  const currentPlan = (input.currentPlan ?? "explorer").toLowerCase();
  const showUpgradeCta = currentPlan === "explorer" || currentPlan === "professional";

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
          "Enhanced realism benefits from OHLCV, spread proxies, and execution metadata.",
          "Include stress increments for spread, slippage, and fees to unlock full scenario coverage.",
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
          "Parameter Stability requires a parameter sweep bundle: multiple runs across parameter combinations with explicit run-to-parameter mapping.",
        unlockRequirements: [
          "Upload one structured bundle/ZIP covering multiple strategy runs.",
          "Include parameter metadata that maps each run_id to its parameter values.",
          "Include per-run trade history/results files (or one combined table with run_id + parameter columns).",
        ],
        actions: [
          { label: "Upload parameter sweep bundle", href: "/app/new-analysis", emphasis: "primary" },
          { label: "Request Strategy Validation", href: "/strategy-validation", emphasis: "secondary" },
        ],
        footerNote:
          "Parameter Stability also requires Research Lab access. Artifact structure and plan tier are both required.",
      };
    }

    if (input.artifactRequirementProfile === "regime_analysis") {
      return {
        diagnosticTitle: input.diagnosticTitle,
        diagnosticPurpose: input.diagnosticPurpose,
        state: input.state,
        badgeLabel: "Artifact Limited",
        primaryExplanation:
          "Regime Analysis requires market context (OHLCV or equivalent) to classify market conditions such as trend and volatility.",
        unlockRequirements: [
          "Required: trade data.",
          "Required: OHLCV market context.",
          "Optional improvements: indicators, regime labels, and benchmark context.",
        ],
        actions: [
          { label: "Upload trade + OHLCV bundle", href: "/app/new-analysis", emphasis: "primary" },
          { label: "Request Strategy Validation", href: "/strategy-validation", emphasis: "secondary" },
        ],
        footerNote: "No regime classifications or proxy regime results are generated when OHLCV context is missing.",
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
    primaryExplanation: `This diagnostic is available on the ${input.requiredPlan ?? "Professional"} plan and above.${input.artifactRequirementProfile ? " It also requires specific structured artifact inputs." : ""}`,
    unlockRequirements: [
      `Current plan: ${input.currentPlan ?? "Explorer"}`,
      `Required plan: ${input.requiredPlan ?? "Professional"}`,
      ...(input.artifactRequirementProfile === "parameter_sweep_bundle"
        ? ["Artifact requirement: parameter sweep bundle with run-to-parameter mapping."]
        : input.artifactRequirementProfile === "regime_analysis"
          ? ["Artifact requirement: OHLCV or equivalent market context to classify regimes."]
          : []),
      "Upgrade unlocks deeper diagnostics and workflow capacity for this surface.",
    ],
    actions: [
      ...(showUpgradeCta ? [{ label: `Upgrade to ${input.requiredPlan ?? "Professional"}`, href: "/app/upgrade", emphasis: "primary" as const }] : []),
      { label: "Request Strategy Validation", href: "/strategy-validation", emphasis: "secondary" },
    ],
    footerNote: showUpgradeCta
      ? "This diagnostic is plan-gated and artifact-dependent."
      : "Artifact requirements still apply even when your plan is already entitled.",
  };
}
