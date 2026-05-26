import type { EChartsOption } from "echarts";
import type { FigurePayload } from "@/lib/contracts";
import { tooltipRows } from "./utils";

export function buildBaseOption(figure: FigurePayload): EChartsOption {
  return {
    animationDuration: 420,
    animationEasing: "cubicOut",
    grid: { left: 78, right: 34, top: 74, bottom: 92, containLabel: true },
    title: {
      text: figure.title,
      subtext: figure.subtitle,
      left: 8,
      textStyle: { fontSize: 13, fontWeight: 600, color: "#272321", fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui" },
      subtextStyle: { fontSize: 11, color: "#56504c", fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: tooltipRows,
      backgroundColor: "rgba(17,16,15,0.96)",
      borderColor: "rgba(176,0,32,0.26)",
      borderWidth: 0,
      textStyle: { color: "#fbfaf7", fontSize: 12, fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui" },
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
    textStyle: { fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui", color: "#56504c" },
  };
}
