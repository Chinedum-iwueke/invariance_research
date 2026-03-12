import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm border text-sm font-medium transition-colors duration-normal disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-white hover:bg-[#92001b]",
        secondary: "border-border-subtle bg-surface-panel text-text-graphite hover:bg-white",
        tertiary: "border-transparent bg-transparent text-text-graphite hover:bg-surface-panel",
        destructive: "border-chart-negative bg-chart-negative text-white hover:bg-[#a92222]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
