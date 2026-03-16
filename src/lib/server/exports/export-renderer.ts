import type { AnalysisRecord } from "@/lib/contracts";
import type { ExportFormat } from "@/lib/server/exports/models";

export function renderExport(record: AnalysisRecord, format: ExportFormat): { bytes: Uint8Array; content_type: string; file_name: string } {
  if (format === "json") {
    const json = JSON.stringify(record, null, 2);
    return { bytes: new Uint8Array(Buffer.from(json, "utf-8")), content_type: "application/json", file_name: `${record.analysis_id}.json` };
  }

  const md = [
    `# Invariance Analysis ${record.analysis_id}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Strategy`,
    `- Name: ${record.strategy.strategy_name}`,
    `- Timeframe: ${record.strategy.timeframe ?? "N/A"}`,
    `- Trades: ${record.dataset.trade_count}`,
    ``,
    `## Verdict`,
    `- ${record.summary.headline_verdict.title}: ${record.summary.headline_verdict.summary}`,
    ``,
    `## Key findings`,
    ...record.summary.key_findings.map((f) => `- ${f}`),
  ].join("\n");

  return { bytes: new Uint8Array(Buffer.from(md, "utf-8")), content_type: "text/markdown", file_name: `${record.analysis_id}.md` };
}
