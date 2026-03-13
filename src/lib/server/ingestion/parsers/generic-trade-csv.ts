import { buildDiagnosticEligibility } from "../eligibility";
import { parsedArtifactSchema } from "../schemas";
import { validateTradeSemantics } from "../validators/semantic";
import { validateTradeCsv } from "../validators/trade-csv";
import type { ParserAdapter, ParserInput, ParserOutput } from "./types";

export const genericTradeCsvParserAdapter: ParserAdapter = {
  kind: "generic_trade_csv",
  canParse(input: ParserInput) {
    return input.file.extension.toLowerCase() === "csv";
  },
  async parse(input: ParserInput): Promise<ParserOutput> {
    const notes: string[] = ["Parsed using generic trade CSV adapter"];
    const csvValidation = validateTradeCsv(input.file.contents ?? "");
    const semanticValidation = validateTradeSemantics(csvValidation.trades);

    const validation = {
      valid: csvValidation.validation.valid && semanticValidation.valid,
      errors: [...csvValidation.validation.errors, ...semanticValidation.errors],
      warnings: [...csvValidation.validation.warnings, ...semanticValidation.warnings],
    };

    const parsedCandidate = {
      artifact_kind: "trade_csv" as const,
      artifact_type: "trade_csv" as const,
      richness: "trade_only" as const,
      trades: csvValidation.trades,
      ohlcv_present: false,
      benchmark_present: false,
      diagnostic_eligibility: buildDiagnosticEligibility("trade_only"),
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
