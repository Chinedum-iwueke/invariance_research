export const ARTIFACT_KINDS = ["trade_csv", "bundle_v1"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_TYPES = [
  "trade_history_bundle",
  "backtest_result_bundle",
  "research_bundle",
] as const;
export type BundleArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_RICHNESS_VALUES = [
  "trade_only",
  "trade_plus_metadata",
  "trade_plus_context",
  "research_complete",
] as const;
export type ArtifactRichness = (typeof ARTIFACT_RICHNESS_VALUES)[number];

export const DIAGNOSTICS = [
  "overview",
  "distribution",
  "monte_carlo",
  "stability",
  "execution",
  "regimes",
  "ruin",
  "report",
] as const;
export type DiagnosticName = (typeof DIAGNOSTICS)[number];

export const DIAGNOSTIC_AVAILABILITY_VALUES = [
  "available",
  "limited",
  "unavailable",
] as const;
export type DiagnosticAvailability = (typeof DIAGNOSTIC_AVAILABILITY_VALUES)[number];

export const PARSER_ADAPTER_KINDS = [
  "generic_trade_csv",
  "generic_bundle_v1",
  "backtrader_trade_csv",
  "mt5_trade_csv",
  "binance_trade_export",
  "bybit_trade_export",
] as const;
export type ParserAdapterKind = (typeof PARSER_ADAPTER_KINDS)[number];

export const VALIDATION_ERROR_CODES = [
  "unsupported_file_type",
  "file_too_large",
  "empty_file",
  "unreadable_contents",
  "invalid_zip_bundle",
  "missing_manifest",
  "invalid_manifest",
  "missing_trades_file",
  "invalid_csv_schema",
  "unrecognized_required_headers",
  "invalid_timestamp",
  "invalid_numeric_field",
  "invalid_trade_direction",
  "invalid_trade_row",
  "unsupported_artifact_structure",
] as const;

export type ArtifactValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export type CanonicalTradeSide = "long" | "short";

export type CanonicalTradeRecord = {
  symbol: string;
  side: CanonicalTradeSide;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  trade_id?: string;
  fees?: number;
  pnl?: number;
  pnl_pct?: number;
  mae?: number;
  mfe?: number;
  duration_seconds?: number;
  strategy_name?: string;
  timeframe?: string;
  market?: string;
  exchange?: string;
  notes?: string;
  entry_reason?: string;
  exit_reason?: string;
  risk_r?: number;
};

export type TradeCsvAliasMap = Record<string, readonly string[]>;

export type BundleManifestV1 = {
  schema_version: "1.0";
  artifact_type: BundleArtifactType;
  strategy_name?: string;
  source_platform?: string;
  symbols?: string[];
  timeframe?: string;
  market?: string;
  exchange?: string;
  currency?: string;
  included_files: string[];
  assumptions_present?: boolean;
  ohlcv_present?: boolean;
  parameter_metadata_present?: boolean;
};

export type BundleMetadata = {
  strategy_name?: string;
  description?: string;
  author?: string;
  source_platform?: string;
  tags?: string[];
};

export type BundleAssumptions = {
  slippage_model?: string;
  commission_model?: string;
  market_impact_model?: string;
  notes?: string;
};

export type BundleParams = {
  parameter_set_name?: string;
  tunable_parameters?: Record<string, string | number | boolean>;
  optimization_target?: string;
};

export type ArtifactValidationError = {
  code: ArtifactValidationErrorCode;
  message: string;
  field?: string;
  row?: number;
};

export type ArtifactValidationResult = {
  valid: boolean;
  errors: ArtifactValidationError[];
  warnings: string[];
};

export type DiagnosticStatus = {
  availability: DiagnosticAvailability;
  reason?: string;
};

export type DiagnosticEligibilityMatrix = Record<DiagnosticName, DiagnosticStatus>;

export type ParsedArtifact = {
  artifact_kind: ArtifactKind;
  artifact_type: BundleArtifactType | "trade_csv";
  richness: ArtifactRichness;
  strategy_metadata?: BundleMetadata;
  trades: CanonicalTradeRecord[];
  equity_curve?: Record<string, string | number>[];
  assumptions?: BundleAssumptions;
  params?: BundleParams;
  ohlcv_present: boolean;
  benchmark_present: boolean;
  diagnostic_eligibility: DiagnosticEligibilityMatrix;
  parser_notes?: string[];
  validation: ArtifactValidationResult;
};

export type UploadEligibilitySummary = {
  accepted: boolean;
  detected_artifact_type: ParsedArtifact["artifact_type"];
  detected_richness: ArtifactRichness;
  diagnostics_available: DiagnosticName[];
  diagnostics_limited: DiagnosticName[];
  diagnostics_unavailable: DiagnosticName[];
  limitation_reasons: string[];
  parser_notes: string[];
  summary_text: string;
};
