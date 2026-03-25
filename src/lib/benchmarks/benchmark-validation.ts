import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import type { BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { BenchmarkValidationIssue, BenchmarkValidationResult } from "@/lib/benchmarks/benchmark-types";

interface PythonValidationPayload {
  success: boolean;
  coverage?: { startTs: string | null; endTs: string | null; rowCount: number | null };
  issues?: Array<{ code: string; message: string }>;
}

export async function validateBenchmarkDataset(input: {
  benchmarkId: BenchmarkId;
  datasetPath: string;
}): Promise<BenchmarkValidationResult> {
  const { benchmarkId, datasetPath } = input;
  const issues: BenchmarkValidationIssue[] = [];

  try {
    await access(datasetPath, fsConstants.F_OK);
  } catch {
    return {
      benchmarkId,
      datasetPath,
      isValid: false,
      coverage: { startTs: null, endTs: null, rowCount: null },
      issues: [{ code: "missing_file", message: `Dataset file does not exist: ${datasetPath}` }],
    };
  }

  try {
    await access(datasetPath, fsConstants.R_OK);
  } catch {
    issues.push({ code: "not_readable", message: `Dataset is not readable: ${datasetPath}` });
  }

  const pythonResult = runParquetValidationWithPython(datasetPath, benchmarkId);
  if (pythonResult.errorIssue) {
    issues.push(pythonResult.errorIssue);
    return {
      benchmarkId,
      datasetPath,
      isValid: false,
      coverage: { startTs: null, endTs: null, rowCount: null },
      issues,
    };
  }

  if (pythonResult.payload?.issues?.length) {
    for (const issue of pythonResult.payload.issues) {
      issues.push({ code: toIssueCode(issue.code), message: issue.message });
    }
  }

  return {
    benchmarkId,
    datasetPath,
    isValid: issues.length === 0 && Boolean(pythonResult.payload?.success),
    coverage: pythonResult.payload?.coverage ?? { startTs: null, endTs: null, rowCount: null },
    issues,
  };
}

function runParquetValidationWithPython(
  datasetPath: string,
  benchmarkId: BenchmarkId,
): { payload?: PythonValidationPayload; errorIssue?: BenchmarkValidationIssue } {
  const script = `
import json
import sys

path = sys.argv[1]
expected_symbol = sys.argv[2]

try:
    import pyarrow.parquet as pq
    import pyarrow.compute as pc
except Exception as exc:
    print(json.dumps({"success": False, "issues": [{"code": "parquet_parser_unavailable", "message": f"pyarrow unavailable: {exc}"}]}))
    sys.exit(0)

issues = []
coverage = {"startTs": None, "endTs": None, "rowCount": None}

try:
    table = pq.read_table(path)
except Exception as exc:
    print(json.dumps({"success": False, "issues": [{"code": "not_readable", "message": f"Unable to read parquet file: {exc}"}], "coverage": coverage}))
    sys.exit(0)

required_columns = ["ts", "symbol", "close"]
field_names = set(table.schema.names)
for column in required_columns:
    if column not in field_names:
        issues.append({"code": "schema_missing_column", "message": f"Missing required column '{column}'"})

if issues:
    print(json.dumps({"success": False, "issues": issues, "coverage": coverage}))
    sys.exit(0)

try:
    row_count = table.num_rows
    coverage["rowCount"] = int(row_count)

    for col in required_columns:
        non_null_count = pc.count(table[col]).as_py()
        if non_null_count == 0:
            issues.append({"code": "required_column_all_null", "message": f"Column '{col}' is entirely null"})

    symbol_array = table["symbol"]
    non_null_symbols = pc.drop_null(symbol_array)
    if len(non_null_symbols) == 0:
        issues.append({"code": "required_column_all_null", "message": "Column 'symbol' is entirely null"})
    else:
        unique_symbols = set(non_null_symbols.to_pylist())
        if unique_symbols != {expected_symbol}:
            issues.append({"code": "symbol_mismatch", "message": f"symbol values do not match expected benchmark '{expected_symbol}'. Found: {sorted(list(unique_symbols))}"})

    ts_non_null = pc.drop_null(table["ts"])
    if len(ts_non_null) > 0:
        coverage["startTs"] = str(pc.min(ts_non_null).as_py())
        coverage["endTs"] = str(pc.max(ts_non_null).as_py())
    else:
        issues.append({"code": "coverage_unavailable", "message": "Column 'ts' has no non-null values"})
except Exception as exc:
    issues.append({"code": "unexpected_error", "message": f"Validation error: {exc}"})

print(json.dumps({"success": len(issues) == 0, "issues": issues, "coverage": coverage}))
`;

  const result = spawnSync("python3", ["-c", script, datasetPath, benchmarkId], {
    encoding: "utf8",
  });

  if (result.error) {
    return {
      errorIssue: {
        code: "parquet_parser_unavailable",
        message: `Failed to execute python3 for parquet validation: ${result.error.message}`,
      },
    };
  }

  if (result.status !== 0 && !result.stdout) {
    return {
      errorIssue: {
        code: "unexpected_error",
        message: `Parquet validation subprocess failed with status ${result.status}: ${result.stderr.trim()}`,
      },
    };
  }

  try {
    return { payload: JSON.parse(result.stdout.trim()) as PythonValidationPayload };
  } catch {
    return {
      errorIssue: {
        code: "unexpected_error",
        message: `Parquet validation returned invalid JSON output: ${result.stdout.trim() || "<empty>"}`,
      },
    };
  }
}

function toIssueCode(rawCode: string): BenchmarkValidationIssue["code"] {
  switch (rawCode) {
    case "missing_file":
    case "not_readable":
    case "parquet_parser_unavailable":
    case "schema_missing_column":
    case "symbol_mismatch":
    case "required_column_all_null":
    case "coverage_unavailable":
    case "unexpected_error":
      return rawCode;
    default:
      return "unexpected_error";
  }
}
