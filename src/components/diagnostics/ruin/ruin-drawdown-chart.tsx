"use client";

import type { EChartsOption } from "echarts";
import type { FigurePayload } from "@/lib/contracts";
import { EChartsHost } from "@/components/charts/echarts-host";

interface RuinCurveSeries {
  label: string;
  points: Array<{ drawdownPct: number; probabilityPct: number }>;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizePct(value: number): number {
  if (Math.abs(value) <= 1) return value * 100;
  return value;
}

function parseCurveSeries(figure?: FigurePayload): RuinCurveSeries[] {
  if (!figure || !Array.isArray(figure.series)) return [];

  return figure.series
    .map((series, idx) => {
      if (!series || typeof series !== "object") return undefined;
      const entry = series as Record<string, unknown>;
      const points = Array.isArray(entry.points) ? entry.points : [];
      const normalizedPoints = points
        .map((point) => {
          if (!point || typeof point !== "object") return undefined;
          const p = point as Record<string, unknown>;
          const drawdownRaw = asFiniteNumber(p.x);
          const probabilityRaw = asFiniteNumber(p.y);
          if (drawdownRaw === undefined || probabilityRaw === undefined) return undefined;
          return {
            drawdownPct: Math.abs(normalizePct(drawdownRaw)),
            probabilityPct: normalizePct(probabilityRaw),
          };
        })
        .filter((point): point is { drawdownPct: number; probabilityPct: number } => Boolean(point))
        .sort((a, b) => a.drawdownPct - b.drawdownPct);

      if (!normalizedPoints.length) return undefined;
      const label = typeof entry.label === "string" && entry.label.trim().length > 0
        ? entry.label
        : `Scenario ${idx + 1}`;

      return { label, points: normalizedPoints };
    })
    .filter((series): series is RuinCurveSeries => Boolean(series));
}

function formatProbability(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDrawdown(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildOption(series: RuinCurveSeries[], accountSize?: number): EChartsOption {
  return {
    grid: { left: 56, right: 28, top: 28, bottom: 56 },
    legend: {
      top: 0,
      textStyle: { color: "#3f4c60", fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f172a",
      borderWidth: 0,
      textStyle: { color: "#f8fafc" },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [params];
        const first = rows[0] as { axisValue?: number } | undefined;
        const drawdown = typeof first?.axisValue === "number" ? first.axisValue : undefined;
        const title = drawdown === undefined ? "Drawdown threshold" : `Drawdown threshold: ${formatDrawdown(drawdown)}`;
        const capitalImpact = accountSize !== undefined && drawdown !== undefined
          ? `<br/>Capital impact: ${formatCurrency((drawdown / 100) * accountSize)}`
          : "";

        const seriesLines = rows
          .map((row) => {
            const entry = row as { marker?: string; seriesName?: string; data?: Array<number> | number };
            const probability = Array.isArray(entry.data)
              ? asFiniteNumber(entry.data[1])
              : asFiniteNumber(entry.data);
            if (probability === undefined) return undefined;
            return `${entry.marker ?? ""}${entry.seriesName ?? "Curve"}: ${formatProbability(probability)}`;
          })
          .filter((line): line is string => Boolean(line));

        return `${title}${capitalImpact}<br/>${seriesLines.join("<br/>")}`;
      },
    },
    xAxis: {
      type: "value",
      name: "Drawdown threshold (%)",
      nameLocation: "middle",
      nameGap: 34,
      axisLabel: {
        formatter: (value: number) => `${Math.round(value)}%`,
      },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    yAxis: {
      type: "value",
      name: "Breach probability (%)",
      nameLocation: "middle",
      nameGap: 44,
      min: 0,
      max: 100,
      axisLabel: {
        formatter: (value: number) => `${Math.round(value)}%`,
      },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: series.map((item, idx) => ({
      name: item.label,
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      showSymbol: false,
      lineStyle: { width: 2 },
      emphasis: { focus: "series" },
      color: idx === 0 ? "#0f766e" : idx === 1 ? "#b91c1c" : undefined,
      data: item.points.map((point) => [point.drawdownPct, point.probabilityPct]),
    })),
  };
}

export function RuinDrawdownChart({ figure, accountSize }: { figure?: FigurePayload; accountSize?: number }) {
  const series = parseCurveSeries(figure);

  if (!series.length) {
    return (
      <p className="rounded-sm border border-dashed border-border-subtle bg-surface-panel p-4 text-sm text-text-neutral">
        Drawdown breach probability curve was not emitted for this run.
      </p>
    );
  }

  const option = buildOption(series, accountSize);

  return <EChartsHost option={option} height={460} />;
}
