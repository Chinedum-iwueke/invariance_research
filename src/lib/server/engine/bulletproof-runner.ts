import { buildAnalysisEngineDispatchPayload } from "@/lib/analyses/analysis-engine-dispatch";
import { runBulletproofEngine } from "@/lib/server/engine/bulletproof-client";
import {
  CAPABILITY_PROFILE_VERSION,
  DIAGNOSTIC_CONTRACT_VERSION,
  ENGINE_ADAPTER_VERSION,
  ENGINE_PARSER_VERSION,
  ENGINE_SEAM_NAME,
  ENGINE_SEAM_VERSION,
  type BulletproofRunResponse,
  type EngineEnvelopeV1,
  type RunBulletproofAnalysisParams,
} from "@/lib/server/engine/engine-types";

export async function runBulletproofAnalysisFromParsedArtifact(params: RunBulletproofAnalysisParams): Promise<BulletproofRunResponse> {
  const { analysis, parsedArtifact, eligibility } = params;
  const startedAt = Date.now();

  const dispatch = await buildAnalysisEngineDispatchPayload({ analysis, parsedArtifact, eligibility });
  const engineParsedArtifact = dispatch.config.declared_claims?.length || dispatch.config.prop_evaluation_rules
    ? {
        ...parsedArtifact,
        declared_claims: dispatch.config.declared_claims?.length
          ? mergeDeclaredClaims(parsedArtifact.declared_claims, dispatch.config.declared_claims)
          : parsedArtifact.declared_claims,
        prop_evaluation_rules: dispatch.config.prop_evaluation_rules ?? parsedArtifact.prop_evaluation_rules,
        strategy_truth_room_contract_version: parsedArtifact.strategy_truth_room_contract_version ?? "1.0.0",
      }
    : parsedArtifact;

  const engineResponse = await runBulletproofEngine(engineParsedArtifact, dispatch.config);
  const result = engineResponse.result;
  const envelope: EngineEnvelopeV1 = {
    engine_name: engineResponse.envelope?.engine_name ?? "bt",
    engine_version: engineResponse.envelope?.engine_version ?? result.envelope?.engine_version ?? engineResponse.engine_version,
    seam_name: ENGINE_SEAM_NAME,
    seam_version: engineResponse.envelope?.seam_version ?? ENGINE_SEAM_VERSION,
    adapter_version: engineResponse.envelope?.adapter_version ?? ENGINE_ADAPTER_VERSION,
    parser_version: engineResponse.envelope?.parser_version ?? ENGINE_PARSER_VERSION,
    capability_profile_version: engineResponse.envelope?.capability_profile_version ?? CAPABILITY_PROFILE_VERSION,
    diagnostic_contract_version: engineResponse.envelope?.diagnostic_contract_version ?? DIAGNOSTIC_CONTRACT_VERSION,
  };
  const degradationReasons = [
    ...(result.skipped_diagnostics?.map((item) => `${item.diagnostic}: ${item.reason}`) ?? []),
    ...dispatch.warnings,
  ];

  return {
    result,
    context: {
      engine_name: envelope.engine_name,
      engine_version: envelope.engine_version ?? result.run_context?.engine_version ?? engineResponse.engine_version,
      seam: ENGINE_SEAM_NAME,
      seam_name: envelope.seam_name,
      seam_version: envelope.seam_version,
      adapter_version: envelope.adapter_version,
      parser_version: envelope.parser_version,
      capability_profile_version: envelope.capability_profile_version,
      diagnostic_contract_version: envelope.diagnostic_contract_version,
      benchmark_config: dispatch.config.benchmark,
      account_size: dispatch.config.account_size,
      risk_per_trade_pct: dispatch.config.risk_per_trade_pct,
      prop_evaluation_rules: dispatch.config.prop_evaluation_rules,
      degraded: degradationReasons.length > 0,
      degradation_reasons: [
        ...degradationReasons,
        ...(Date.now() - startedAt > 5_000 ? ["engine_runtime_exceeded_soft_target"] : []),
      ],
    },
  };
}

function mergeDeclaredClaims(
  artifactClaims: NonNullable<RunBulletproofAnalysisParams["parsedArtifact"]["declared_claims"]> | undefined,
  runtimeClaims: NonNullable<RunBulletproofAnalysisParams["parsedArtifact"]["declared_claims"]>,
) {
  const seen = new Set<string>();
  return [...(artifactClaims ?? []), ...runtimeClaims]
    .map((claim, index) => ({
      ...claim,
      claim_id: claim.claim_id ?? `declared_claim_${index + 1}`,
      source: claim.source ?? "analysis_intake",
    }))
    .filter((claim) => {
      const key = claim.claim.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
