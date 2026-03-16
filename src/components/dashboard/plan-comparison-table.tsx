import { Check, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";

const rows = [
  ["Trade CSV upload", "yes", "yes", "yes", "yes"],
  ["Structured bundle upload", "no", "yes", "yes", "custom"],
  ["Research bundle upload", "no", "no", "yes", "custom"],
  ["Analyses per month", "3", "25", "100", "custom"],
  ["Overview diagnostics", "yes", "yes", "yes", "yes"],
  ["Distribution diagnostics", "yes", "yes", "yes", "yes"],
  ["Monte Carlo diagnostics", "yes", "yes", "yes", "yes"],
  ["Risk of Ruin", "basic", "full", "full", "full"],
  ["Execution sensitivity", "no", "yes", "yes", "yes"],
  ["Regime analysis", "no", "no", "yes", "yes"],
  ["Stability / fragility diagnostics", "no", "no", "yes", "yes"],
  ["Report export", "no", "yes", "yes", "yes"],
  ["History retention", "30 days", "365 days", "730 days", "custom"],
  ["Processing priority", "standard", "priority", "premium", "institutional"],
];

function cell(value: string) {
  if (value === "yes") return <Check className="mx-auto h-4 w-4" />;
  if (value === "no") return <Minus className="mx-auto h-4 w-4 text-text-neutral" />;
  return <span className="text-xs text-text-neutral">{value}</span>;
}

export function PlanComparisonTable() {
  return (
    <Card className="overflow-x-auto rounded-md border bg-white p-0">
      <table className="min-w-[760px] w-full text-sm">
        <thead>
          <tr className="border-b bg-surface-panel text-left">
            <th className="px-4 py-3 font-semibold">Capability</th>
            <th className="px-4 py-3 text-center font-semibold">Explorer</th>
            <th className="px-4 py-3 text-center font-semibold">Professional</th>
            <th className="px-4 py-3 text-center font-semibold">Research Lab</th>
            <th className="px-4 py-3 text-center font-semibold">Advisory</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b last:border-b-0">
              <td className="px-4 py-3 text-text-graphite">{row[0]}</td>
              <td className="px-4 py-3 text-center">{cell(row[1])}</td>
              <td className="px-4 py-3 text-center">{cell(row[2])}</td>
              <td className="px-4 py-3 text-center">{cell(row[3])}</td>
              <td className="px-4 py-3 text-center">{cell(row[4])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
