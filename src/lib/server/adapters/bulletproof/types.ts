export interface RawOverviewResult {
  score?: number;
  overfittingRiskPct?: number;
  figureSeries?: Array<{ key: string; label: string; points: Array<{ x: number; y: number }> }>;
}

export interface RawMonteCarloResult {
  worstDrawdownPct?: number;
  ruinProbabilityPct?: number;
  medianPath?: Array<{ x: number; y: number }>;
  warnings?: Array<{ code: string; message: string }>;
}

export interface RawReportResult {
  generatedAt?: string;
  executiveSummary?: string;
  assumptions?: string[];
  recommendations?: string[];
}

export interface RawEngineAnalysisResult {
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  strategyName: string;
  symbols: string[];
  tradeCount: number;
  overview?: RawOverviewResult;
  monteCarlo?: RawMonteCarloResult;
  report?: RawReportResult;
}
