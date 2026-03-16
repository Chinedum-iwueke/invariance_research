import type { AnalysisRecord } from "@/lib/contracts";
import type { ExportFormat } from "@/lib/server/exports/models";

export function renderExport(record: AnalysisRecord, format: ExportFormat): { bytes: Uint8Array; content_type: string; file_name: string } {
  if (format === "json") {
    const json = JSON.stringify(record, null, 2);
    return { bytes: new Uint8Array(Buffer.from(json, "utf-8")), content_type: "application/json", file_name: `${record.analysis_id}.json` };
  }

  if (format === "pdf") {
    const lines = buildReportLines(record);
    const pdf = buildSimplePdf(lines);
    return { bytes: pdf, content_type: "application/pdf", file_name: `${record.analysis_id}.pdf` };
  }

  const md = [`# Invariance Analysis ${record.analysis_id}`, `Generated: ${new Date().toISOString()}`, "", ...buildReportLines(record)].join("\n");

  return { bytes: new Uint8Array(Buffer.from(md, "utf-8")), content_type: "text/markdown", file_name: `${record.analysis_id}.md` };
}

function buildReportLines(record: AnalysisRecord): string[] {
  return [
    "## Strategy",
    `- Name: ${record.strategy.strategy_name}`,
    `- Timeframe: ${record.strategy.timeframe ?? "N/A"}`,
    `- Trades: ${record.dataset.trade_count}`,
    "",
    "## Verdict",
    `- ${record.summary.headline_verdict.title}: ${record.summary.headline_verdict.summary}`,
    "",
    "## Key findings",
    ...record.summary.key_findings.map((finding) => `- ${finding}`),
  ];
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const escaped = lines
    .flatMap((line) => wrap(line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"), 90))
    .map((line) => `(${line}) Tj`)
    .join("\nT*\n");

  const contentStream = `BT\n/F1 11 Tf\n50 770 Td\n14 TL\n${escaped}\nET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(contentStream, "utf-8")} >> stream\n${contentStream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "utf-8"));
}

function wrap(value: string, max: number): string[] {
  if (value.length <= max) return [value];
  const parts: string[] = [];
  let remaining = value;
  while (remaining.length > max) {
    parts.push(remaining.slice(0, max));
    remaining = remaining.slice(max);
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}
