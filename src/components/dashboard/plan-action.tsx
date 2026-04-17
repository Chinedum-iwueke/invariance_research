import Link from "next/link";
import type { PlanId } from "@/lib/contracts/account";
import { buttonVariants } from "@/components/ui/button";

const PLAN_ORDER: PlanId[] = ["explorer", "professional", "research_lab", "advisory"];

type ActionKind = "upgrade" | "downgrade" | "current" | "request";

export function getPlanAction(currentPlan: PlanId, targetPlan: PlanId): ActionKind {
  if (targetPlan === "advisory") return "request";
  if (currentPlan === targetPlan) return "current";
  return PLAN_ORDER.indexOf(targetPlan) > PLAN_ORDER.indexOf(currentPlan) ? "upgrade" : "downgrade";
}

export function PlanAction({ currentPlan, targetPlan, className }: { currentPlan: PlanId; targetPlan: PlanId; className?: string }) {
  const action = getPlanAction(currentPlan, targetPlan);

  if (action === "current") {
    return <span className={buttonVariants({ size: "sm", variant: "secondary", className })}>Current Plan</span>;
  }

  if (action === "request") {
    return (
      <Link href="/contact" className={buttonVariants({ size: "sm", variant: "secondary", className })}>
        Request
      </Link>
    );
  }

  if (action === "downgrade") {
    return (
      <Link href="/app/billing" className={buttonVariants({ size: "sm", variant: "secondary", className })}>
        Downgrade
      </Link>
    );
  }

  return <Link href="/app/billing" className={buttonVariants({ size: "sm", className })}>Upgrade</Link>;
}
