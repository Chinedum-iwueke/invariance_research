import type { EChartsOption, SeriesOption } from "echarts";
import type { FigurePayload, FigureSeries } from "@/lib/contracts";

export interface AdaptedChart {
  option: EChartsOption;
  summary: FigureSeries[];
  note?: string;
  supportsLegend: boolean;
}

export interface AdapterContext {
  figure: FigurePayload;
  series: FigureSeries[];
}

export type FigureTypeAdapter = (context: AdapterContext) => AdaptedChart | undefined;

export interface AxisMeta {
  categories: Array<string | number>;
  isCategoryAxis: boolean;
  bySeries: Map<string, Map<string | number, number>>;
}

export type ChartSeries = Exclude<SeriesOption, SeriesOption[]>;
