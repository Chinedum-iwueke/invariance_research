import type { ParsedArtifact } from "@/lib/server/ingestion";
import type { EngineAnalysisResult } from "@/lib/server/engine/engine-types";

type BulletproofModule = {
  run_analysis_from_parsed_artifact: (parsedArtifact: ParsedArtifact, config?: Record<string, unknown>) => Promise<EngineAnalysisResult>;
};

export async function runBulletproofEngine(parsedArtifact: ParsedArtifact, config?: Record<string, unknown>): Promise<EngineAnalysisResult> {
  const mod = (await import("bulletproof_bt")) as unknown as BulletproofModule;

  if (!mod?.run_analysis_from_parsed_artifact) {
    throw new Error("engine_entrypoint_missing");
  }

  return mod.run_analysis_from_parsed_artifact(parsedArtifact, config);
}
