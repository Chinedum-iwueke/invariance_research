import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement } from "react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-sm border text-center text-sm font-medium leading-tight transition-[background-color,border-color,box-shadow,color,transform] duration-normal ease-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-white shadow-[0_12px_28px_-20px_var(--brand-research-red)] hover:-translate-y-px hover:bg-research-red-hover hover:shadow-[0_16px_34px_-18px_var(--brand-research-red)]",
        secondary: "border-border-subtle bg-surface-panel text-text-graphite hover:-translate-y-px hover:border-border-strong hover:bg-surface-white hover:shadow-soft",
        tertiary: "border-transparent bg-transparent text-text-graphite hover:bg-surface-panel hover:text-text-institutional",
        destructive: "border-chart-negative bg-chart-negative text-white hover:bg-[#a92222]",
      },
      size: {
        sm: "min-h-8 px-3 py-1.5",
        md: "min-h-10 px-4 py-2",
        lg: "min-h-12 px-6 py-3",
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, children, ...props }: ButtonProps) {
  const mergedClassName = cn(buttonVariants({ variant, size }), className);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      ...props,
      className: cn(mergedClassName, child.props.className),
    });
  }

  return <button className={mergedClassName} {...props}>{children}</button>;
}
