import Link from "next/link";
import type { DiagnosticLockAction } from "@/lib/app/diagnostic-locks";
import { buttonVariants } from "@/components/ui/button";

export function DiagnosticLockActions({ actions }: { actions: DiagnosticLockAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={`${action.label}-${action.href}`}
          href={action.href}
          className={buttonVariants({ size: "sm", variant: action.emphasis === "primary" ? "primary" : "secondary" })}
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
