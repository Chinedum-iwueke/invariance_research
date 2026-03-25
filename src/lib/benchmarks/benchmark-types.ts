import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";

export type BenchmarkFrequency = "1d";
export type BenchmarkSource = "platform_managed";
export type BenchmarkLibraryHealthStatus = "healthy" | "degraded" | "unhealthy";

export interface BenchmarkManifestEntry {
  id: BenchmarkId;
  file: string;
  frequency: BenchmarkFrequency;
  source: BenchmarkSource;
}

export interface BenchmarkManifest {
  revision: string | null;
  benchmarks: Record<BenchmarkId, BenchmarkManifestEntry>;
}

export type BenchmarkValidationIssueCode =
  | "missing_file"
  | "not_readable"
  | "parquet_parser_unavailable"
  | "schema_missing_column"
  | "symbol_mismatch"
  | "required_column_all_null"
  | "coverage_unavailable"
  | "invalid_manifest_entry"
  | "unexpected_error";

export interface BenchmarkValidationIssue {
  code: BenchmarkValidationIssueCode;
  message: string;
}

export interface BenchmarkCoverage {
  startTs: string | null;
  endTs: string | null;
  rowCount: number | null;
}

export interface BenchmarkValidationResult {
  benchmarkId: BenchmarkId;
  datasetPath: string;
  isValid: boolean;
  coverage: BenchmarkCoverage;
  issues: BenchmarkValidationIssue[];
}

export interface BenchmarkLibraryHealthResult {
  status: BenchmarkLibraryHealthStatus;
  revision: string | null;
  manifestPath: string;
  benchmarkEntryCount: number;
  benchmarkIds: BenchmarkId[];
  benchmarkResults: Record<BenchmarkId, BenchmarkValidationResult>;
  errors: string[];
}
