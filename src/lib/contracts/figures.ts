export type FigureType = "line" | "area" | "bar" | "grouped_bar" | "histogram" | "scatter" | "fan" | "fan_chart" | "heatmap" | "table";

export interface FigurePoint {
  x: string | number;
  y: number;
}

export interface FigureLegendItem {
  key: string;
  label: string;
}

export interface FigureSeries {
  key: string;
  label: string;
  series_type: "line" | "area" | "bar" | "scatter";
  points: FigurePoint[];
}

export interface FigurePayload {
  figure_id: string;
  title: string;
  subtitle?: string;
  type: FigureType;
  series: unknown[];
  x?: Array<string | number>;
  bins?: Array<Record<string, unknown>>;
  groups?: Array<Record<string, unknown>>;
  points?: Array<Record<string, unknown> | [string | number, number]>;
  bands?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  x_label?: string;
  y_label?: string;
  legend?: FigureLegendItem[];
  note?: string;
  provenance?: "engine_native" | "adapter_normalized" | "synthesized_fallback" | "reconstructed_from_trades";
  [key: string]: unknown;
}
