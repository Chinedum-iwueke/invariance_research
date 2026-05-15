import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CtaBannerProps {
  title: string;
  description: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export function CtaBanner({ title, description, primary, secondary }: CtaBannerProps) {
  return (
    <Card className="relative overflow-hidden rounded-sm border-border-strong bg-surface-paper p-card-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="eyebrow text-brand">Next evidence step</p>
        <h2 className="font-display text-[2rem] font-medium leading-[1] md:text-5xl">{title}</h2>
        <p className="text-sm leading-relaxed text-text-neutral md:text-base">{description}</p>
        <div className="mobile-cta-row justify-center">
          <Link href={primary.href} className={buttonVariants()}>{primary.label}</Link>
          {secondary ? <Link href={secondary.href} className={buttonVariants({ variant: "secondary" })}>{secondary.label}</Link> : null}
        </div>
      </div>
    </Card>
  );
}
