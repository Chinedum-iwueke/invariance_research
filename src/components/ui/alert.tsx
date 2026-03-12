import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const alertVariants = cva("rounded-sm border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-chart-benchmark/30 bg-chart-benchmark/5 text-text-graphite",
      success: "border-chart-positive/30 bg-chart-positive/5 text-text-graphite",
      warning: "border-brand/30 bg-brand/5 text-text-graphite",
      critical: "border-chart-negative/40 bg-chart-negative/5 text-text-graphite",
    },
  },
  defaultVariants: { tone: "info" },
});

interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title: string;
  message: string;
}

export function Alert({ className, tone, title, message, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ tone }), className)} role="status" {...props}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-text-neutral">{message}</p>
    </div>
  );
}
