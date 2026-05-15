import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sectionHeaderVariants = cva("space-y-3", {
  variants: {
    align: {
      left: "text-left",
      center: "text-center",
    },
  },
  defaultVariants: {
    align: "left",
  },
});

interface SectionHeaderProps extends VariantProps<typeof sectionHeaderVariants> {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description, align }: SectionHeaderProps) {
  return (
    <header className={cn(sectionHeaderVariants({ align }))}>
      {eyebrow ? <p className="eyebrow text-brand">{eyebrow}</p> : null}
      <h2 className="text-[1.9rem] font-semibold leading-[1.08] md:text-4xl md:leading-tight">{title}</h2>
      {description ? <p className="max-w-3xl text-[0.95rem] leading-relaxed text-text-neutral md:text-base">{description}</p> : null}
    </header>
  );
}
