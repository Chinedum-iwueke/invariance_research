import type { FigurePayload } from "@/lib/contracts";

export type AnalysisPageDebugBranch =
  | "native_figures_branch"
  | "singular_figure_branch"
  | "fallback_reconstructed_branch"
  | "empty_state_branch";

interface AnalysisPageDebugEvent {
  analysis_id: string;
  page: "overview" | "distribution" | "monte_carlo" | "execution" | "report";
  input_figure_count: number;
  input_figure_types: string[];
  singular_figure_present: boolean;
  fallback_figure_source_available: boolean;
  selected_figure_count: number;
  selected_figure_types: string[];
  branch: AnalysisPageDebugBranch;
  empty_state_reason?: string;
}

export function figureTypes(figures: Array<FigurePayload | undefined>): string[] {
  return figures.filter(Boolean).map((figure) => figure?.type ?? "unknown");
}

export function logAnalysisPageDebug(event: AnalysisPageDebugEvent) {
  console.log("[analysis-page-debug]", event);
}

