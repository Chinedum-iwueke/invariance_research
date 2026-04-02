import type { AnalysisRecord, FigurePayload, ScoreBand } from "@/lib/contracts";
import { buildDecisionSnapshotMetrics, buildReportViewModel } from "@/lib/app/report-view";
import { mapOverviewBenchmarkPayload } from "@/lib/diagnostics/overview/map-benchmark-payload";
import type { ExportFormat } from "@/lib/server/exports/models";

export function renderExport(record: AnalysisRecord, format: ExportFormat): { bytes: Uint8Array; content_type: string; file_name: string } {
  if (format === "json") {
    const json = JSON.stringify(record, null, 2);
    return { bytes: new Uint8Array(Buffer.from(json, "utf-8")), content_type: "application/json", file_name: `${record.analysis_id}.json` };
  }

  const report = buildReportViewModel(record);

  if (format === "pdf") {
    const pdf = buildInstitutionalPdf(record, report);
    return { bytes: pdf, content_type: "application/pdf", file_name: `${record.analysis_id}-validation-report.pdf` };
  }

  const benchmark = mapOverviewBenchmarkPayload(record.diagnostics.overview.benchmark_comparison);
  const md = [
    `# Invariance Research Validation Report — ${record.strategy.strategy_name}`,
    `Generated: ${record.report.generated_at ?? new Date().toISOString()}`,
    "",
    "## Executive Summary",
    record.report.executive_summary,
    "",
    "## Decision Snapshot",
    ...buildDecisionSnapshotMetrics(record).map((metric) => `- ${metric.label}: ${metric.value}`),
    "",
    "## Verdict",
    `${report.verdict.statusLabel}: ${report.verdict.headline}`,
    report.verdict.summary,
    "",
    "## Benchmark",
    benchmark?.available
      ? `Strategy return: ${benchmark.summary_metrics?.strategy_return ?? "N/A"} | Benchmark return: ${benchmark.summary_metrics?.benchmark_return ?? "N/A"} | Excess return: ${benchmark.summary_metrics?.excess_return_vs_benchmark ?? "N/A"}`
      : `Unavailable${benchmark?.reason_label ? ` (${benchmark.reason_label})` : ""}`,
  ].join("\n");

  return { bytes: new Uint8Array(Buffer.from(md, "utf-8")), content_type: "text/markdown", file_name: `${record.analysis_id}.md` };
}

interface PdfOp {
  text: string;
  x: number;
  y: number;
  size?: number;
}

interface PdfPage {
  ops: PdfOp[];
  charts: Array<{ figure: FigurePayload; x: number; y: number; width: number; height: number }>;
}

interface WrappedLine {
  text: string;
}

const PAGE = { width: 612, height: 792, margin: 44 };

function buildInstitutionalPdf(record: AnalysisRecord, report: ReturnType<typeof buildReportViewModel>): Uint8Array {
  const benchmark = mapOverviewBenchmarkPayload(record.diagnostics.overview.benchmark_comparison);
  const decisionMetrics = buildDecisionSnapshotMetrics(record);
  const pages: PdfPage[] = [{ ops: [], charts: [] }];
  let current = pages[0];
  let y = PAGE.height - PAGE.margin;

  const ensureRoom = (heightNeeded: number) => {
    if (y - heightNeeded < PAGE.margin) {
      current = { ops: [], charts: [] };
      pages.push(current);
      y = PAGE.height - PAGE.margin;
      drawPageHeader(current, record);
      y -= 30;
    }
  };

  const write = (text: string, opts?: { size?: number; leading?: number; bold?: boolean }) => {
    const safeText = String(text ?? "").trim();
    if (!safeText) return;
    const size = opts?.size ?? 10;
    const leading = opts?.leading ?? Math.max(12, size + 2);
    ensureRoom(leading + 4);
    current.ops.push({ text: opts?.bold ? `**${safeText}**` : safeText, x: PAGE.margin, y, size });
    y -= leading;
  };

  const writeBlock = (title: string, lines: WrappedLine[], options?: { gapAfter?: number }) => {
    write(title, { size: 13, leading: 18, bold: true });
    if (!lines.length) {
      write("No data emitted for this section.", { size: 10, leading: 14 });
      y -= options?.gapAfter ?? 8;
      return;
    }
    for (const line of lines) {
      for (const wrapped of wrap(line.text, 94)) {
        write(`• ${wrapped}`, { size: 10, leading: 14 });
      }
    }
    y -= options?.gapAfter ?? 8;
  };

  const writeFigure = (title: string, figure?: FigurePayload) => {
    if (!figure) {
      write(`${title}: figure unavailable (text interpretation retained).`, { size: 9, leading: 13 });
      return;
    }

    ensureRoom(180);
    write(title, { size: 12, leading: 16, bold: true });
    current.charts.push({ figure, x: PAGE.margin, y: y - 8, width: 520, height: 130 });
    y -= 150;
  };

  drawPageHeader(current, record);
  y -= 36;

  write("Validation Report", { size: 19, leading: 24, bold: true });
  write(`Strategy: ${record.strategy.strategy_name}`, { size: 11, leading: 16 });
  write(`Coverage: ${record.dataset.start_date ?? "N/A"} to ${record.dataset.end_date ?? "N/A"} | Trades: ${record.dataset.trade_count}`, { size: 10, leading: 14 });
  write(`Verdict: ${report.verdict.statusLabel} — ${report.verdict.headline}`, { size: 11, leading: 16, bold: true });
  wrap(report.verdict.summary, 95).forEach((line) => write(line, { size: 10, leading: 14 }));
  y -= 4;

  writeBlock("Executive Summary", [{ text: record.report.executive_summary }]);
  writeBlock("Decision Snapshot Metrics", decisionMetrics.map((metric: ScoreBand) => ({ text: `${metric.label}: ${metric.value}` })));

  writeBlock("Top-line Performance & Benchmark", [
    { text: benchmark?.available ? `Strategy return ${benchmark.summary_metrics?.strategy_return ?? "N/A"}, benchmark return ${benchmark.summary_metrics?.benchmark_return ?? "N/A"}, excess return ${benchmark.summary_metrics?.excess_return_vs_benchmark ?? "N/A"}.` : `Benchmark comparison unavailable${benchmark?.reason_label ? ` (${benchmark.reason_label})` : ""}.` },
    { text: `Comparison window: ${benchmark?.metadata?.comparison_window_start ?? "N/A"} to ${benchmark?.metadata?.comparison_window_end ?? "N/A"}.` },
    { text: `Normalization basis: ${benchmark?.metadata?.normalization_basis ?? benchmark?.metadata?.alignment_basis ?? "N/A"}.` },
  ]);

  writeBlock("Risk & Survivability", record.diagnostics.ruin.metrics.map((metric) => ({ text: `${metric.label}: ${metric.value}` })));
  writeBlock("Monte Carlo & Tail Risk", record.diagnostics.monte_carlo.metrics.map((metric) => ({ text: `${metric.label}: ${metric.value}` })));
  writeBlock("Execution Sensitivity", record.diagnostics.execution.metrics.map((metric) => ({ text: `${metric.label}: ${metric.value}` })));
  writeBlock("Distribution & Trade Behavior", record.diagnostics.distribution.metrics.map((metric) => ({ text: `${metric.label}: ${metric.value}` })));
  writeBlock("Key Limitations", (report.limitations.length ? report.limitations : ["No explicit report limitations were emitted."]).map((line) => ({ text: line })));
  writeBlock("Recommendations", report.recommendations.map((line) => ({ text: line })));

  write("Selected Figures", { size: 13, leading: 18, bold: true });
  writeFigure("Top-line Equity", report.prioritizedFigures.topLine);
  writeFigure("Benchmark Comparison", report.prioritizedFigures.benchmark ?? benchmark?.figure);
  writeFigure("Survivability / Ruin", report.prioritizedFigures.survivability);
  writeFigure("Monte Carlo", report.prioritizedFigures.monteCarlo);
  writeFigure("Execution Expectancy Decay", report.prioritizedFigures.execution);
  report.prioritizedFigures.distribution.slice(0, 1).forEach((figure) => writeFigure(`Distribution: ${figure.title}`, figure));

  return compilePdf(pages);
}

function drawPageHeader(page: PdfPage, record: AnalysisRecord) {
  page.ops.push({ text: "INVARIANCE RESEARCH", x: PAGE.margin, y: PAGE.height - 26, size: 11 });
  page.ops.push({ text: "Validation Report", x: PAGE.width - 170, y: PAGE.height - 26, size: 9 });
  page.ops.push({ text: `Strategy: ${record.strategy.strategy_name}`, x: PAGE.margin, y: PAGE.height - 40, size: 8 });
  page.ops.push({ text: `Generated: ${record.report.generated_at ?? record.updated_at}`, x: PAGE.width - 250, y: PAGE.height - 40, size: 8 });
}

function compilePdf(pages: PdfPage[]): Uint8Array {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects[0] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";

  pages.forEach((_, idx) => {
    const contentId = 6 + idx * 2;
    const pageId = 7 + idx * 2;
    contentObjectIds.push(contentId);
    pageObjectIds.push(pageId);
  });

  objects[1] = `2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >> endobj`;
  objects[2] = "3 0 obj << /ProcSet [/PDF /Text] /Font << /F1 4 0 R /F2 5 0 R >> >> endobj";
  objects[3] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
  objects[4] = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj";

  pages.forEach((page, index) => {
    const contentId = contentObjectIds[index];
    const pageId = pageObjectIds[index];
    const stream = buildPageStream(page);
    objects[contentId - 1] = `${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "utf-8")} >> stream\n${stream}\nendstream endobj`;
    objects[pageId - 1] = `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources 3 0 R /Contents ${contentId} 0 R >> endobj`;
  });

  const orderedObjects = objects.filter(Boolean);
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  orderedObjects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += `${obj}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${orderedObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${orderedObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "utf-8"));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSeriesPoints(figure: FigurePayload): Array<Array<{ x: number; y: number }>> {
  const series = Array.isArray(figure.series) ? figure.series : [];
  return series
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const maybeSeries = candidate as { points?: unknown[] };
      const points = Array.isArray(maybeSeries.points) ? maybeSeries.points : [];
      return points
        .map((point, idx) => {
          if (!point || typeof point !== "object") return undefined;
          const shaped = point as { x?: unknown; y?: unknown };
          const xValue = isFiniteNumber(shaped.x) ? shaped.x : idx;
          const yValue = shaped.y;
          if (!isFiniteNumber(yValue)) return undefined;
          return { x: xValue, y: yValue };
        })
        .filter((point): point is { x: number; y: number } => Boolean(point));
    })
    .filter((seriesPoints) => seriesPoints.length > 1);
}

function buildPageStream(page: PdfPage): string {
  const ops: string[] = ["BT"];

  for (const op of page.ops) {
    const bold = op.text.startsWith("**") && op.text.endsWith("**");
    const rawText = bold ? op.text.slice(2, -2) : op.text;
    const escaped = escapePdfText(rawText);
    const font = bold ? "/F2" : "/F1";
    const size = op.size ?? 10;
    ops.push(`${font} ${size} Tf`);
    ops.push(`1 0 0 1 ${op.x} ${op.y} Tm`);
    ops.push(`(${escaped}) Tj`);
  }

  ops.push("ET");

  for (const chart of page.charts) {
    try {
      ops.push(...drawChart(chart.figure, chart.x, chart.y, chart.width, chart.height));
    } catch {
      // Skip malformed figure payloads; textual report content remains intact.
    }
  }

  return ops.join("\n");
}

function drawChart(figure: FigurePayload, x: number, y: number, width: number, height: number): string[] {
  const normalizedSeries = normalizeSeriesPoints(figure).slice(0, 3);
  if (!normalizedSeries.length) {
    return [
      "q",
      "0.95 0.95 0.95 rg",
      `${x} ${y - height} ${width} ${height} re f`,
      "0.75 0.78 0.84 RG",
      `${x} ${y - height} ${width} ${height} re S`,
      "Q",
    ];
  }

  const allPoints = normalizedSeries.flat();
  const xValues = allPoints.map((point) => point.x);
  const yValues = allPoints.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const colorPalette: Array<[number, number, number]> = [
    [0.16, 0.35, 0.77],
    [0.0, 0.55, 0.32],
    [0.61, 0.28, 0.86],
    [0.89, 0.31, 0.18],
  ];

  const xPos = (value: number) => x + ((value - minX) / spanX) * width;
  const yPos = (value: number) => y - ((value - minY) / spanY) * height;

  const commands: string[] = [
    "q",
    "0.88 0.9 0.94 rg",
    `${x} ${y - height} ${width} ${height} re f`,
    "0.75 0.78 0.84 RG",
    `${x} ${y - height} ${width} ${height} re S`,
  ];

  normalizedSeries.forEach((series, index) => {
    const color = colorPalette[index % colorPalette.length];
    commands.push(`${color[0]} ${color[1]} ${color[2]} RG`);
    commands.push("1.3 w");

    series.forEach((point, pointIndex) => {
      const px = xPos(point.x);
      const py = yPos(point.y);
      commands.push(`${px} ${py} ${pointIndex === 0 ? "m" : "l"}`);
    });
    commands.push("S");
  });

  commands.push("Q");
  return commands;
}

function wrap(value: string, max: number): string[] {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) return [""];
  const words = safeValue.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = words[0] ?? "";
  for (let idx = 1; idx < words.length; idx += 1) {
    const word = words[idx] ?? "";
    const candidate = `${current} ${word}`;
    if (candidate.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
