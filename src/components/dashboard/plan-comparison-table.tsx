import { Check, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlanId } from "@/lib/contracts/account";
import { PlanAction } from "@/components/dashboard/plan-action";

const launchPlans = [
  { id: "free" as const, label: "Free" },
  { id: "individual" as const, label: "Individual" },
  { id: "pro" as const, label: "Pro" },
  { id: "team" as const, label: "Team" },
  { id: "research_desk" as const, label: "Research Desk" },
];

const rows = [
  ["Price", "$0", "$39/mo", "$99/mo", "$399/mo", "From $1,000"],
  ["Trade CSV upload", "yes", "yes", "yes", "yes", "yes"],
  ["Structured bundle upload", "no", "yes", "yes", "yes", "yes"],
  ["Research bundle upload", "no", "no", "yes", "yes", "yes"],
  ["Max upload size", "10 MB", "25 MB", "50 MB", "100 MB", "250 MB"],
  ["Analyses per month", "3", "25", "100", "250", "Scoped"],
  ["Overview / distribution / Monte Carlo", "preview", "full", "full", "full", "full"],
  ["Risk of Ruin", "preview", "full", "full", "full", "full"],
  ["Prop Evaluation Readiness", "fallback preview", "1 profile/run", "saved profiles", "shared profiles", "rule interpretation"],
  ["Execution sensitivity", "no", "evidence-gated", "evidence-gated", "evidence-gated", "broker review"],
  ["Regime analysis", "no", "no", "aligned OHLCV", "aligned OHLCV", "attribution review"],
  ["Stability / fragility diagnostics", "no", "no", "sweep-required", "sweep-required", "sweep design/review"],
  ["Report export", "no", "yes", "yes", "yes", "yes"],
  ["Share links", "no", "5/mo", "25/mo", "75/mo", "Scoped"],
  ["Research Desk request", "no", "no", "yes", "yes", "included"],
  ["Insufficient-evidence escalation", "contact", "add-on", "eligible", "priority", "included"],
  ["Seats", "1", "1", "1", "5", "10"],
  ["History retention", "30 days", "365 days", "730 days", "3 years", "5 years"],
  ["Processing priority", "standard", "priority", "premium", "institutional", "institutional"],
];

function cell(value: string) {
  if (value === "yes") return <Check className="mx-auto h-4 w-4" />;
  if (value === "no") return <Minus className="mx-auto h-4 w-4 text-text-neutral" />;
  return <span className="text-xs text-text-neutral">{value}</span>;
}

export function PlanComparisonTable({ currentPlan }: { currentPlan?: PlanId }) {
  return (
    <Card className="overflow-x-auto rounded-md border bg-surface-white p-0">
      <table className="min-w-[980px] w-full text-sm">
        <thead>
          <tr className="border-b bg-surface-panel text-left">
            <th className="px-4 py-3 font-semibold">Capability</th>
            {launchPlans.map((plan) => (
              <th key={plan.id} className="px-4 py-3 text-center font-semibold">{plan.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b last:border-b-0">
              <td className="px-4 py-3 text-text-graphite">{row[0]}</td>
              {row.slice(1).map((value, index) => (
                <td key={`${row[0]}-${launchPlans[index]?.id}`} className="px-4 py-3 text-center">{cell(value)}</td>
              ))}
            </tr>
          ))}
          {currentPlan ? (
            <tr>
              <td className="px-4 py-3 text-text-graphite">Plan action</td>
              {launchPlans.map((plan) => (
                <td key={`action-${plan.id}`} className="px-4 py-3 text-center">
                  <PlanAction currentPlan={currentPlan} targetPlan={plan.id} className="mx-auto" />
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
