import { buildAnalysisEngineDispatchPayload } from "@/lib/analyses/analysis-engine-dispatch";
import { runBulletproofEngine } from "@/lib/server/engine/bulletproof-client";
import type { BulletproofRunResponse, RunBulletproofAnalysisParams } from "@/lib/server/engine/engine-types";

export async function runBulletproofAnalysisFromParsedArtifact(params: RunBulletproofAnalysisParams): Promise<BulletproofRunResponse> {
  const { analysis, parsedArtifact, eligibility } = params;
  const startedAt = Date.now();

  const dispatch = await buildAnalysisEngineDispatchPayload({ analysis, parsedArtifact, eligibility });

  const engineResponse = await runBulletproofEngine(parsedArtifact, dispatch.config);
  const result = engineResponse.result;
  const degradationReasons = [
    ...(result.skipped_diagnostics?.map((item) => `${item.diagnostic}: ${item.reason}`) ?? []),
    ...dispatch.warnings,
  ];

  return {
    result,
    context: {
      engine_name: "bt",
      engine_version: result.run_context?.engine_version ?? engineResponse.engine_version,
      seam: "run_analysis_from_parsed_artifact",
      benchmark_config: dispatch.config.benchmark,
      account_size: dispatch.config.account_size,
      risk_per_trade_pct: dispatch.config.risk_per_trade_pct,
      degraded: degradationReasons.length > 0,
      degradation_reasons: [
        ...degradationReasons,
        ...(Date.now() - startedAt > 5_000 ? ["engine_runtime_exceeded_soft_target"] : []),
      ],
    },
  };
}
