import type { ParsedArtifact } from "@/lib/server/ingestion";
import type { EngineAnalysisResult } from "@/lib/server/engine/engine-types";

export type BulletproofModule = {
  __version__?: string;
  run_analysis_from_parsed_artifact: (parsedArtifact: ParsedArtifact, config?: Record<string, unknown>) => Promise<EngineAnalysisResult>;
};

export async function loadBulletproofModule(): Promise<BulletproofModule> {
  return (await import("bt")) as unknown as BulletproofModule;
}

export async function runBulletproofEngine(parsedArtifact: ParsedArtifact, config?: Record<string, unknown>, module?: BulletproofModule): Promise<EngineAnalysisResult> {
  const mod = module ?? await loadBulletproofModule();

  if (!mod?.run_analysis_from_parsed_artifact) {
    throw new Error("engine_entrypoint_missing");
  }

  return mod.run_analysis_from_parsed_artifact(parsedArtifact, config);
}
