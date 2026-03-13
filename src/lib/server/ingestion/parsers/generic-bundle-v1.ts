import { classifyArtifactRichness } from "../classifiers";
import { buildDiagnosticEligibility } from "../eligibility";
import { bundleAssumptionsSchema, bundleMetadataSchema, bundleParamsSchema, parsedArtifactSchema } from "../schemas";
import { validateBundleV1 } from "../validators/bundle";
import { validateTradeSemantics } from "../validators/semantic";
import { validateTradeCsv } from "../validators/trade-csv";
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

    const parsedCandidate = {
      artifact_kind: "bundle_v1" as const,
      artifact_type: bundle.manifest.artifact_type,
      richness,
      strategy_metadata: metadata,
      trades: csvValidation.trades,
      equity_curve: bundle.files["equity_curve.csv"] ? [{ source: "equity_curve.csv" }] : undefined,
      assumptions,
      params,
      ohlcv_present: Boolean(bundle.files["ohlcv.csv"] || bundle.files["ohlcv.parquet"]),
      benchmark_present: Boolean(bundle.files["benchmark.csv"]),
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
