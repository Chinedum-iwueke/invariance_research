import Link from "next/link";
import type { AnalysisSummary } from "@/lib/mock/analysis";
import { AnalysisStatusBadge } from "@/components/dashboard/analysis-status-badge";
import { Card } from "@/components/ui/card";

export function AnalysisTable({ analyses }: { analyses: AnalysisSummary[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-panel">
          <tr>
            <th className="p-3">Strategy</th>
            <th className="p-3">Date</th>
            <th className="p-3">Asset</th>
            <th className="p-3">Score</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id} className="border-t hover:bg-surface-panel/40">
              <td className="p-3">
                <Link href={`/app/analyses/${analysis.id}/overview`} className="font-medium text-text-institutional hover:text-brand">
                  {analysis.strategy_name}
                </Link>
                <p className="text-xs text-text-neutral">{analysis.trade_count} trades • {analysis.timeframe}</p>
              </td>
              <td className="p-3 text-text-neutral">{analysis.created_at}</td>
              <td className="p-3 text-text-neutral">{analysis.asset}</td>
              <td className="p-3 text-text-graphite">{analysis.robustness_score}</td>
              <td className="p-3"><AnalysisStatusBadge status={analysis.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
