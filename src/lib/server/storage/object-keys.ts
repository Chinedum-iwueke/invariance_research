import path from "node:path";

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "file";
}

function normalizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  return `${safeSegment(parsed.name)}${safeSegment(parsed.ext || "")}`;
}

export function buildUploadObjectKey(input: { accountId: string; artifactId: string; fileName: string }) {
  return `uploads/${safeSegment(input.accountId)}/${safeSegment(input.artifactId)}/${normalizeFileName(input.fileName)}`;
}

export function buildAnalysisArtifactObjectKey(input: { accountId: string; analysisId: string; fileName: string }) {
  return `analysis-artifacts/${safeSegment(input.accountId)}/${safeSegment(input.analysisId)}/${normalizeFileName(input.fileName)}`;
}

export function buildExperimentArtifactObjectKey(input: { accountId: string; programId: string; jobId: string; fileName: string }) {
  return `analysis-artifacts/${safeSegment(input.accountId)}/programs/${safeSegment(input.programId)}/experiments/${safeSegment(input.jobId)}/${normalizeFileName(input.fileName)}`;
}

export function buildReportObjectKey(input: { accountId: string; analysisId: string; fileName: string }) {
  return `reports/${safeSegment(input.accountId)}/${safeSegment(input.analysisId)}/${normalizeFileName(input.fileName)}`;
}

export function buildPublicationObjectKey(input: { publicationId: string; fileName: string }) {
  return `publications/${safeSegment(input.publicationId)}/${normalizeFileName(input.fileName)}`;
}

export function buildPublicationCoverObjectKey(input: { publicationId: string; fileName: string }) {
  return `publication-covers/${safeSegment(input.publicationId)}/${normalizeFileName(input.fileName)}`;
}
