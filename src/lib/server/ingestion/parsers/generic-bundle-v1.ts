import { classifyArtifactRichness } from "../classifiers";
import { buildDiagnosticEligibility } from "../eligibility";
import { bundleAssumptionsSchema, bundleMetadataSchema, bundleParamsSchema, parsedArtifactSchema } from "../schemas";
import { validateBundleV1 } from "../validators/bundle";
import { validateTradeSemantics } from "../validators/semantic";
import { validateTradeCsv } from "../validators/trade-csv";
import { STRATEGY_TRUTH_ROOM_CONTRACT_VERSION, type StrategyTruthRoomArtifactFamily } from "@/lib/contracts/strategy-truth-room";
import type { ParserAdapter, ParserInput, ParserOutput } from "./types";

export const genericBundleV1ParserAdapter: ParserAdapter = {
  kind: "generic_bundle_v1",
  canParse(input: ParserInput) {
    return input.file.extension.toLowerCase() === "zip";
  },
  async parse(input: ParserInput): Promise<ParserOutput> {
    const notes: string[] = ["Parsed using generic bundle V1 adapter"];

    const bundle = validateBundleV1({
      zipBytes: input.file.bytes,
      entries: input.extractedBundleEntries ?? [],
    });

    if (!bundle.validation.valid || !bundle.manifest) {
      return { notes: [...notes, "Bundle validation failed"] };
    }

    const tradesCsv = bundle.files["trades.csv"]?.text ?? "";
    const csvValidation = validateTradeCsv(tradesCsv);
    const semanticValidation = validateTradeSemantics(csvValidation.trades);

    const validation = {
      valid: bundle.validation.valid && csvValidation.validation.valid && semanticValidation.valid,
      errors: [
        ...bundle.validation.errors,
        ...csvValidation.validation.errors,
        ...semanticValidation.errors,
      ],
      warnings: [
        ...bundle.validation.warnings,
        ...csvValidation.validation.warnings,
        ...semanticValidation.warnings,
      ],
    };

    const metadata = parseJsonFile(bundle.files["metadata.json"]?.text, bundleMetadataSchema);
    const assumptions = parseJsonFile(bundle.files["assumptions.json"]?.text, bundleAssumptionsSchema);
    const params = parseJsonFile(bundle.files["params.json"]?.text, bundleParamsSchema);
    const declaredClaims = parseDeclaredClaims(bundle.files["declared_claims.json"]?.text);
    const ohlcv = parseLooseCsv(bundle.files["ohlcv.csv"]?.text);
    const benchmarkSeries = parseLooseCsv(bundle.files["benchmark.csv"]?.text);
    const brokerExports = parseLooseCsv(bundle.files["broker_export.csv"]?.text);

    const richness = classifyArtifactRichness({
      metadataPresent: Boolean(metadata),
      assumptionsPresent: Boolean(assumptions),
      equityCurvePresent: Boolean(bundle.files["equity_curve.csv"]),
      ohlcvPresent: Boolean(bundle.files["ohlcv.csv"] || bundle.files["ohlcv.parquet"]),
      paramsPresent: Boolean(params),
    });

    const diagnostic_eligibility = buildDiagnosticEligibility(richness, {
      assumptionsPresent: Boolean(assumptions),
      ohlcvPresent: Boolean(bundle.files["ohlcv.csv"] || bundle.files["ohlcv.parquet"]),
      paramsPresent: Boolean(params),
    });

    const sourceFiles = buildSourceFiles(bundle.manifest.files ?? [], Object.keys(bundle.files));

    const parsedCandidate = {
      artifact_kind: "bundle_v1" as const,
      artifact_type: bundle.manifest.artifact_type,
      richness,
      strategy_metadata: metadata,
      trades: csvValidation.trades,
      equity_curve: bundle.files["equity_curve.csv"] ? [{ source: "equity_curve.csv" }] : undefined,
      assumptions,
      params,
      ohlcv,
      benchmark_series: benchmarkSeries,
      broker_exports: brokerExports,
      declared_claims: declaredClaims,
      source_files: sourceFiles,
      bundle_manifest: bundle.manifest,
      strategy_truth_room_contract_version: bundle.manifest.contract_version ?? STRATEGY_TRUTH_ROOM_CONTRACT_VERSION,
      ohlcv_present: Boolean(bundle.files["ohlcv.csv"] || bundle.files["ohlcv.parquet"]),
      benchmark_present: Boolean(bundle.files["benchmark.csv"]),
      broker_export_present: Boolean(bundle.files["broker_export.csv"]),
      diagnostic_eligibility,
      parser_notes: notes,
      validation,
    };

    const parsed = parsedArtifactSchema.safeParse(parsedCandidate);
    if (!parsed.success) {
      return {
        notes: [...notes, "Failed parsed artifact schema validation"],
      };
    }

    return { parsed: parsed.data, notes };
  },
};

function parseJsonFile<T>(text: string | undefined, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }): T | undefined {
  if (!text) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function parseDeclaredClaims(text: string | undefined) {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.claims) ? parsed.claims : [];
    const claims = rows
      .map((item: unknown, index: number) => {
        if (typeof item === "string") return { claim_id: `claim_${index + 1}`, claim: item, source: "declared_claims.json" };
        if (!item || typeof item !== "object") return undefined;
        const record = item as Record<string, unknown>;
        const claim = typeof record.claim === "string" ? record.claim : typeof record.text === "string" ? record.text : undefined;
        if (!claim) return undefined;
        return {
          claim_id: typeof record.claim_id === "string" ? record.claim_id : `claim_${index + 1}`,
          claim,
          source: typeof record.source === "string" ? record.source : "declared_claims.json",
          priority: record.priority === "low" || record.priority === "medium" || record.priority === "high" || record.priority === "critical" ? record.priority : undefined,
        };
      })
      .filter(Boolean);
    return claims.length ? claims : undefined;
  } catch {
    return undefined;
  }
}

function parseLooseCsv(text: string | undefined): Record<string, string | number>[] | undefined {
  if (!text) return undefined;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return undefined;
  const columns = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, coerceCell(values[index] ?? "")]));
  });
  return rows.length ? rows : undefined;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
}

function coerceCell(value: string): string | number {
  const numeric = Number(value);
  return value !== "" && Number.isFinite(numeric) ? numeric : value;
}

function buildSourceFiles(
  manifestFiles: Array<{ path: string; role: StrategyTruthRoomArtifactFamily; schema_version?: string; sha256?: string; required?: boolean }>,
  actualPaths: string[],
) {
  const byPath = new Map(manifestFiles.map((file) => [file.path, file]));
  return actualPaths.map((path) => {
    const manifestFile = byPath.get(path);
    return {
      path,
      role: manifestFile?.role ?? "legacy_bundle_file" as const,
      schema_version: manifestFile?.schema_version,
      sha256: manifestFile?.sha256,
      required: manifestFile?.required,
      recognized: Boolean(manifestFile) || path === "manifest.json" || path === "trades.csv",
      parser_note: manifestFile ? undefined : "File recognized through legacy bundle filename handling.",
    };
  });
}
