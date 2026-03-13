import type { UploadArtifact } from "@/lib/server/analysis/models";

const artifacts = new Map<string, UploadArtifact>();

export const artifactRepository = {
  save(artifact: UploadArtifact): UploadArtifact {
    artifacts.set(artifact.artifact_id, artifact);
    return artifact;
  },
  findById(artifactId: string): UploadArtifact | undefined {
    return artifacts.get(artifactId);
  },
  attachAnalysis(artifactId: string, analysisId: string) {
    const artifact = artifacts.get(artifactId);
    if (!artifact) return;
    artifact.analysis_id = analysisId;
    artifacts.set(artifactId, artifact);
  },
};
