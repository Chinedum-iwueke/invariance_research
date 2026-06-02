"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanId } from "@/lib/contracts/account";
import { buttonVariants } from "@/components/ui/button";

const PLAN_ORDER = ["free", "explorer", "pro", "team", "research_desk"] as const;

type ActionKind = "upgrade" | "downgrade" | "current" | "request";

function canonicalPlanId(planId: PlanId): (typeof PLAN_ORDER)[number] {
  if (planId === "explorer" || planId === "pro" || planId === "team" || planId === "research_desk" || planId === "free") return planId;
  if (planId === "individual" || planId === "professional") return "explorer";
  if (planId === "research_lab") return "pro";
  if (planId === "advisory") return "research_desk";
  return "free";
}

export function getPlanAction(currentPlan: PlanId, targetPlan: PlanId): ActionKind {
  const current = canonicalPlanId(currentPlan);
  const target = canonicalPlanId(targetPlan);
  if (target === "research_desk") return "request";
  if (current === target) return "current";
  return PLAN_ORDER.indexOf(target) > PLAN_ORDER.indexOf(current) ? "upgrade" : "downgrade";
}

export function PlanAction({ currentPlan, targetPlan, className }: { currentPlan: PlanId; targetPlan: PlanId; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
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
        Manage
      </Link>
    );
  }

  async function startCheckout() {
    setState("loading");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: targetPlan }),
    });
    const payload = await response.json().catch(() => ({})) as { url?: string };
    if (response.ok && payload.url) {
      window.location.href = payload.url;
      return;
    }
    setState("failed");
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button type="button" onClick={() => void startCheckout()} disabled={state === "loading"} className={buttonVariants({ size: "sm", className })}>
        {state === "loading" ? "Opening..." : "Upgrade"}
      </button>
      {state === "failed" ? <span className="text-[11px] text-red-600">Checkout unavailable</span> : null}
    </div>
  );
}
