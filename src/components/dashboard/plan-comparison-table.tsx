import { Check, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlanId } from "@/lib/contracts/account";
import { PlanAction } from "@/components/dashboard/plan-action";

const validationPlans = [
  { id: "free" as const, label: "Free" },
  { id: "explorer" as const, label: "Explorer" },
  { id: "pro" as const, label: "Pro" },
  { id: "research_desk" as const, label: "Research Desk" },
];

const rows = [
  ["Price", "$0", "$39/mo", "$99/mo", "From $1,000"],
  ["Research programs", "1", "3", "10", "Scoped"],
  ["Active hypotheses", "2", "10", "40", "Scoped"],
  ["Queued experiments", "2", "12", "40", "Scoped"],
  ["Concurrent experiments", "1", "1", "2", "Scoped"],
  ["Monthly compute units", "10", "80", "250", "Scoped"],
  ["Assistant calls", "10", "100", "500", "Scoped"],
  ["Memory retention", "30 days", "365 days", "730 days", "5 years"],
  ["Trade CSV / exchange export import", "yes", "yes", "yes", "yes"],
  ["Optional context ZIP import", "no", "yes", "yes", "yes"],
  ["Max upload size", "10 MB", "25 MB", "50 MB", "250 MB"],
  ["Analyses per month", "3", "25", "100", "Scoped"],
  ["Core robustness workbench", "preview", "full", "full", "reviewed"],
  ["Exact prop rule entry", "fallback only", "per run", "saved profiles", "reviewed"],
  ["First breach + rolling windows", "preview", "full", "full", "reviewed"],
  ["Distribution / edge concentration", "preview", "full", "full", "reviewed"],
  ["Monte Carlo survival", "preview", "full", "full", "reviewed"],
  ["Risk of Ruin", "preview", "full", "full", "reviewed"],
  ["Execution sensitivity", "limited", "evidence-gated", "evidence-gated", "broker review"],
  ["Report export", "no", "yes", "yes", "yes"],
  ["Share links", "no", "5/mo", "25/mo", "Scoped"],
  ["Research Desk request", "no", "no", "yes", "included"],
  ["Deferred advanced scope", "Research Desk", "Research Desk", "request eligible", "included"],
  ["Insufficient-evidence escalation", "contact", "add-on", "eligible", "included"],
  ["Seats", "1", "1", "1", "Scoped"],
  ["Audit history retention", "30 days", "365 days", "730 days", "5 years"],
  ["Processing priority", "standard", "priority", "premium", "institutional"],
];

function cell(value: string) {
  if (value === "yes") return <Check className="mx-auto h-4 w-4" />;
  if (value === "no") return <Minus className="mx-auto h-4 w-4 text-text-neutral" />;
  return <span className="text-xs text-text-neutral">{value}</span>;
}

export function PlanComparisonTable({ currentPlan }: { currentPlan?: PlanId }) {
  return (
    <Card className="overflow-x-auto rounded-md border bg-surface-white p-0">
      <table className="min-w-[840px] w-full text-sm">
        <thead>
          <tr className="border-b bg-surface-panel text-left">
            <th className="px-4 py-3 font-semibold">Capability</th>
            {validationPlans.map((plan) => (
              <th key={plan.id} className="px-4 py-3 text-center font-semibold">{plan.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b last:border-b-0">
              <td className="px-4 py-3 text-text-graphite">{row[0]}</td>
              {row.slice(1).map((value, index) => (
                <td key={`${row[0]}-${validationPlans[index]?.id}`} className="px-4 py-3 text-center">{cell(value)}</td>
              ))}
            </tr>
          ))}
          {currentPlan ? (
            <tr>
              <td className="px-4 py-3 text-text-graphite">Plan action</td>
              {validationPlans.map((plan) => (
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
