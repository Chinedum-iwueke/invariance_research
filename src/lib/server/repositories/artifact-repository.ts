import type { UploadArtifact } from "@/lib/server/analysis/models";
import { getDb } from "@/lib/server/persistence/database";

function mapRow(row: Record<string, unknown>): UploadArtifact {
  return {
    artifact_id: String(row.artifact_id),
    owner_user_id: String(row.owner_user_id),
    account_id: String(row.account_id),
    analysis_id: row.analysis_id ? String(row.analysis_id) : undefined,
    file_name: String(row.file_name),
    file_type: String(row.file_type),
    file_size_bytes: Number(row.file_size_bytes),
    storage_key: String(row.storage_key),
    checksum_sha256: row.checksum_sha256 ? String(row.checksum_sha256) : "",
    artifact_kind: row.artifact_kind as UploadArtifact["artifact_kind"],
    richness: row.richness as UploadArtifact["richness"],
    uploaded_at: String(row.uploaded_at),
    parsed_artifact: JSON.parse(String(row.parsed_artifact_json)),
    eligibility_summary: JSON.parse(String(row.eligibility_summary_json)),
  };
}

export const artifactRepository = {
  save(artifact: UploadArtifact): UploadArtifact {
    getDb()
      .prepare(
        `INSERT INTO artifacts (artifact_id, owner_user_id, account_id, analysis_id, file_name, file_type, file_size_bytes, storage_key, checksum_sha256, artifact_kind, richness, uploaded_at, parsed_artifact_json, eligibility_summary_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifact.artifact_id,
        artifact.owner_user_id,
        artifact.account_id,
        artifact.analysis_id ?? null,
        artifact.file_name,
        artifact.file_type,
        artifact.file_size_bytes,
        artifact.storage_key,
        artifact.checksum_sha256,
        artifact.artifact_kind,
        artifact.richness,
        artifact.uploaded_at,
        JSON.stringify(artifact.parsed_artifact),
        JSON.stringify(artifact.eligibility_summary),
      );
    return artifact;
  },
  findById(artifactId: string): UploadArtifact | undefined {
    const row = getDb().prepare("SELECT * FROM artifacts WHERE artifact_id = ?").get(artifactId) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  },
  attachAnalysis(artifactId: string, analysisId: string) {
    getDb().prepare("UPDATE artifacts SET analysis_id = ? WHERE artifact_id = ?").run(analysisId, artifactId);
  },
};
