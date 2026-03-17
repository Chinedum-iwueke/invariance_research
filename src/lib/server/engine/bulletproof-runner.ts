import { runBulletproofEngine } from "@/lib/server/engine/bulletproof-client";
import type { BulletproofRunResponse, RunBulletproofAnalysisParams } from "@/lib/server/engine/engine-types";

export async function runBulletproofAnalysisFromParsedArtifact(params: RunBulletproofAnalysisParams): Promise<BulletproofRunResponse> {
  const { parsedArtifact, eligibility } = params;
  const startedAt = Date.now();

  const config = {
    eligibility,
    requested_diagnostics: eligibility.diagnostics_available,
  };

  const engineResponse = await runBulletproofEngine(parsedArtifact, config);
  const result = engineResponse.result;
  const degradationReasons = [
    ...(result.skipped_diagnostics?.map((item) => `${item.diagnostic}: ${item.reason}`) ?? []),
  ];

  return {
    result,
    context: {
      engine_name: "bt",
      engine_version: result.run_context?.engine_version ?? engineResponse.engine_version,
      seam: "run_analysis_from_parsed_artifact",
      degraded: degradationReasons.length > 0,
      degradation_reasons: [
        ...degradationReasons,
        ...(Date.now() - startedAt > 5_000 ? ["engine_runtime_exceeded_soft_target"] : []),
      ],
    },
  };
}
