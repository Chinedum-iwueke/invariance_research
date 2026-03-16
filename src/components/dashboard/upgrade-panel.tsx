import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UpgradePanelProps {
  title: string;
  explanation: string;
  planHint: string;
}

export function UpgradePanel({ title, explanation, planHint }: UpgradePanelProps) {
  return (
    <Card className="space-y-4 rounded-md border border-brand/20 bg-brand/5 p-card-md">
      <h3 className="text-base font-semibold text-text-institutional">{title}</h3>
      <p className="text-sm leading-relaxed text-text-neutral">{explanation}</p>
      <p className="text-xs uppercase tracking-[0.08em] text-text-neutral">{planHint}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/upgrade" className={buttonVariants({ size: "sm" })}>
          Review upgrade options
        </Link>
        <Link href="/contact" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          Request strategy audit
        </Link>
      </div>
    </Card>
  );
}
