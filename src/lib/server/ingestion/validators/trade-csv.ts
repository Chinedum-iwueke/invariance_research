import { createTradeCsvAliasMap, normalizeTradeSide, resolveCanonicalField } from "../aliases";
import type {
  ArtifactValidationError,
  ArtifactValidationResult,
  CanonicalTradeRecord,
  TradeCsvAliasMap,
} from "../contracts";
import { canonicalTradeSchema } from "../schemas";
import { parseFiniteNumber } from "../utils/numeric";
import { normalizeTimestampToUtcIso } from "../utils/timestamps";

type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export const REQUIRED_TRADE_CSV_FIELDS = [
  "symbol",
  "side",
  "entry_time",
  "exit_time",
  "entry_price",
  "exit_price",
  "quantity",
] as const;

export const OPTIONAL_TRADE_CSV_NUMERIC_FIELDS = [
  "fees",
  "pnl",
  "pnl_pct",
  "mae",
  "mfe",
  "duration_seconds",
  "risk_r",
] as const;

export const OPTIONAL_TRADE_CSV_TEXT_FIELDS = [
  "trade_id",
  "strategy_name",
  "timeframe",
  "market",
  "exchange",
  "notes",
  "entry_reason",
  "exit_reason",
] as const;

export type TradeCsvValidationOutput = {
  validation: ArtifactValidationResult;
  trades: CanonicalTradeRecord[];
  resolvedHeaders: Record<string, string>;
};

export function validateTradeCsv(
  rawCsv: string,
  customAliasMap?: Partial<TradeCsvAliasMap>,
): TradeCsvValidationOutput {
  const errors: ArtifactValidationError[] = [];
  const warnings: string[] = [];
  const parsed = parseCsv(rawCsv);

  if (!parsed) {
    return {
      validation: {
        valid: false,
        errors: [{ code: "invalid_csv_schema", message: "CSV could not be parsed" }],
        warnings,
      },
      trades: [],
      resolvedHeaders: {},
    };
  }

  const aliasMap = createTradeCsvAliasMap(customAliasMap);
  const resolvedHeaders: Record<string, string> = {};

  for (const header of parsed.headers) {
    const canonical = resolveCanonicalField(header, aliasMap);
    if (canonical && !resolvedHeaders[canonical]) {
      resolvedHeaders[canonical] = header;
    }
  }

  const missingRequiredFields: string[] = [];

  for (const requiredField of REQUIRED_TRADE_CSV_FIELDS) {
    if (!resolvedHeaders[requiredField]) {
      missingRequiredFields.push(requiredField);
      errors.push({
        code: "unrecognized_required_headers",
        message: `Missing required field: ${requiredField}`,
        field: requiredField,
      });
    }
  }

  if (missingRequiredFields.length > 0) {
    errors.unshift({
      code: "invalid_csv_schema",
      message: `Missing required headers: ${missingRequiredFields.join(", ")}. Found headers: ${parsed.headers.join(", ") || "<none>"}`,
    });
  }

  if (errors.length > 0) {
    return {
      validation: { valid: false, errors, warnings },
      trades: [],
      resolvedHeaders,
    };
  }

  const trades: CanonicalTradeRecord[] = [];

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const trade = mapCsvRowToCanonical(row, resolvedHeaders, rowNumber, errors);
    if (trade) {
      trades.push(trade);
    }
  });

  return {
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    trades,
    resolvedHeaders,
  };
}

function mapCsvRowToCanonical(
  row: Record<string, string>,
  resolvedHeaders: Record<string, string>,
  rowNumber: number,
  errors: ArtifactValidationError[],
): CanonicalTradeRecord | undefined {
  const symbol = readText(row, resolvedHeaders.symbol);
  const sideRaw = readText(row, resolvedHeaders.side);
  const side = sideRaw ? normalizeTradeSide(sideRaw) : undefined;

  if (!side) {
    errors.push({
      code: "invalid_trade_direction",
      message: `Unable to normalize trade side: ${sideRaw ?? "<missing>"}`,
      row: rowNumber,
      field: "side",
    });
    return undefined;
  }

  const entryTimeRaw = readText(row, resolvedHeaders.entry_time);
  const exitTimeRaw = readText(row, resolvedHeaders.exit_time);
  const entry_time = entryTimeRaw ? normalizeTimestampToUtcIso(entryTimeRaw) : undefined;
  const exit_time = exitTimeRaw ? normalizeTimestampToUtcIso(exitTimeRaw) : undefined;

  if (!entry_time || !exit_time) {
    errors.push({
      code: "invalid_timestamp",
      message: "Entry or exit timestamp was not parseable",
      row: rowNumber,
    });
    return undefined;
  }

  const entry_price = parseRequiredNumber(row, resolvedHeaders.entry_price, rowNumber, errors);
  const exit_price = parseRequiredNumber(row, resolvedHeaders.exit_price, rowNumber, errors);
  const quantity = parseRequiredNumber(row, resolvedHeaders.quantity, rowNumber, errors);

  if (!symbol || entry_price === undefined || exit_price === undefined || quantity === undefined) {
    errors.push({
      code: "invalid_trade_row",
      message: "Required trade fields are missing or invalid",
      row: rowNumber,
    });
    return undefined;
  }

  const candidate: CanonicalTradeRecord = {
    symbol,
    side,
    entry_time,
    exit_time,
    entry_price,
    exit_price,
    quantity,
  };

  for (const field of OPTIONAL_TRADE_CSV_NUMERIC_FIELDS) {
    const sourceHeader = resolvedHeaders[field];
    if (!sourceHeader) continue;
    const value = row[sourceHeader];
    if (!value) continue;
    const numeric = parseFiniteNumber(value);
    if (numeric === undefined) {
      errors.push({
        code: "invalid_numeric_field",
        message: `Invalid numeric field: ${field}`,
        row: rowNumber,
        field,
      });
      continue;
    }
    (candidate as Record<string, unknown>)[field] = numeric;
  }

  for (const field of OPTIONAL_TRADE_CSV_TEXT_FIELDS) {
    const sourceHeader = resolvedHeaders[field];
    if (!sourceHeader) continue;
    const value = readText(row, sourceHeader);
    if (!value) continue;
    (candidate as Record<string, unknown>)[field] = value;
  }

  const schemaCheck = canonicalTradeSchema.safeParse(candidate);
  if (!schemaCheck.success) {
    errors.push({
      code: "invalid_trade_row",
      message: schemaCheck.error.issues[0]?.message ?? "Invalid trade row",
      row: rowNumber,
    });
    return undefined;
  }

  return schemaCheck.data;
}

function parseCsv(rawCsv: string): CsvParseResult | undefined {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return undefined;

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
}

function readText(row: Record<string, string>, header?: string): string | undefined {
  if (!header) return undefined;
  const value = row[header]?.trim();
  return value ? value : undefined;
}

function parseRequiredNumber(
  row: Record<string, string>,
  header: string | undefined,
  rowNumber: number,
  errors: ArtifactValidationError[],
): number | undefined {
  if (!header) return undefined;
  const value = row[header];
  const numeric = parseFiniteNumber(value);
  if (numeric === undefined) {
    errors.push({
      code: "invalid_numeric_field",
      message: `Invalid numeric value for ${header}`,
      row: rowNumber,
      field: header,
    });
  }
  return numeric;
}
