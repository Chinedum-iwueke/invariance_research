import type { EChartsOption } from "echarts";
import type { FigurePayload } from "@/lib/contracts";
import { tooltipRows } from "./utils";

export function buildBaseOption(figure: FigurePayload): EChartsOption {
  return {
    animationDuration: 350,
    grid: { left: 78, right: 34, top: 74, bottom: 92, containLabel: true },
    title: {
      text: figure.title,
      subtext: figure.subtitle,
      left: 8,
      textStyle: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
      subtextStyle: { fontSize: 11, color: "#64748b" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: tooltipRows,
      backgroundColor: "rgba(15,23,42,0.96)",
      borderWidth: 0,
      textStyle: { color: "#f8fafc", fontSize: 12 },
    },
    toolbox: {
      right: 10,
      itemSize: 14,
      feature: {
        saveAsImage: { title: "Export PNG" },
        dataZoom: { title: { zoom: "Zoom", back: "Reset zoom" } },
        restore: { title: "Reset" },
      },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "slider", xAxisIndex: 0, height: 16, bottom: 14 },
    ],
    textStyle: { fontFamily: "Inter, ui-sans-serif, system-ui" },
  };
}
