import type { UploadArtifact } from "@/lib/server/analysis/models";
import type { ArtifactRepository } from "@/lib/server/persistence/contracts";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function parseJson(value: unknown) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

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
    uploaded_at: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
    parsed_artifact: parseJson(row.parsed_artifact_json) as UploadArtifact["parsed_artifact"],
    eligibility_summary: parseJson(row.eligibility_summary_json) as UploadArtifact["eligibility_summary"],
  };
}

export const postgresArtifactRepository = {
  mode: "read-write",
  async save(artifact: UploadArtifact) {
    await getPostgresPool().query(
      `INSERT INTO artifacts (artifact_id, owner_user_id, account_id, analysis_id, file_name, file_type, file_size_bytes, storage_key, checksum_sha256, artifact_kind, richness, uploaded_at, parsed_artifact_json, eligibility_summary_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
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
      ],
    );
    return artifact;
  },
  async findById(artifactId: string) {
    const result = await getPostgresPool().query("SELECT * FROM artifacts WHERE artifact_id = $1", [artifactId]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  },
  async attachAnalysis(artifactId: string, analysisId: string) {
    await getPostgresPool().query("UPDATE artifacts SET analysis_id = $1 WHERE artifact_id = $2", [analysisId, artifactId]);
  },
} as unknown as ArtifactRepository;
