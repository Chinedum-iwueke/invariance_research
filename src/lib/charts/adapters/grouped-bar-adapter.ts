import type { FigureTypeAdapter } from "./types";
import { buildBaseOption } from "./base-option";
import { resolveAxisMeta } from "./utils";

const PALETTE = ["#356ae6", "#009966", "#9747ff", "#e45c34", "#0087a3"];

type GroupDatum = { label: string; count: number; pct?: number };

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeGroupData(figure: Parameters<FigureTypeAdapter>[0]["figure"]): GroupDatum[] {
  const raw = figure as Parameters<FigureTypeAdapter>[0]["figure"] & Record<string, unknown>;
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  return groups.reduce<GroupDatum[]>((acc, group) => {
      if (!group || typeof group !== "object") return acc;
      const entry = group as Record<string, unknown>;
      const label = typeof entry.label === "string" ? entry.label : typeof entry.name === "string" ? entry.name : undefined;
      const count = toNumber(entry.count) ?? toNumber(entry.value) ?? toNumber(entry.y);
      if (!label || count === undefined) return acc;
      acc.push({ label, count, pct: toNumber(entry.pct) });
      return acc;
    }, []);
}

export const groupedBarAdapter: FigureTypeAdapter = ({ figure, series }) => {
  if (!series.length) return undefined;

  const groupedData = normalizeGroupData(figure);
  const axisMeta = resolveAxisMeta(series);
  const option = buildBaseOption(figure);

  option.legend = {
    show: series.length > 1,
    top: 44,
    itemWidth: 10,
    textStyle: { color: "#475569", fontSize: 11 },
  };
  option.xAxis = {
    type: "category",
    name: figure.x_label ?? "Category",
    nameLocation: "middle",
    nameGap: 44,
    axisLabel: { color: "#475569", hideOverlap: true },
    data: groupedData.length ? groupedData.map((item) => item.label) : axisMeta.categories,
  };
  option.yAxis = {
    type: "value",
    name: figure.y_label ?? "Value",
    nameLocation: "middle",
    nameGap: 52,
    axisLabel: { color: "#475569" },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
  };
  option.series = series.map((item, index) => ({
    name: item.label,
    type: "bar",
    itemStyle: { color: PALETTE[index % PALETTE.length], borderRadius: [2, 2, 0, 0] },
    emphasis: { focus: "series" },
    data: groupedData.length
      ? groupedData.map((entry) => ({ value: entry.count, groupLabel: entry.label, count: entry.count, pct: entry.pct }))
      : axisMeta.categories.map((x) => axisMeta.bySeries.get(item.key)?.get(x) ?? null),
  }));
  if (groupedData.length) {
    option.tooltip = {
      ...(option.tooltip ?? {}),
      trigger: "item",
      formatter: (param) => {
        const row = Array.isArray(param) ? param[0] : param;
        const data = (row?.data ?? {}) as { groupLabel?: string; count?: number; pct?: number };
        const pct = typeof data.pct === "number" ? `${(data.pct * 100).toFixed(2)}%` : "—";
        return [
          `<div style="margin-bottom:4px">${data.groupLabel ?? row?.name ?? "Group"}</div>`,
          `${row?.marker ?? ""}count: <b>${String(data.count ?? row?.value ?? "—")}</b>`,
          `pct: <b>${pct}</b>`,
        ].join("<br/>");
      },
    };
  }

  return { option, summary: series, note: figure.note, supportsLegend: series.length > 1 };
};
