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
    <Card className="rounded-lg bg-surface-panel p-card-lg">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <h2 className="text-[1.65rem] font-semibold leading-[1.16] md:text-3xl md:leading-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-text-neutral md:text-base">{description}</p>
        <div className="mobile-cta-row justify-center">
          <Link href={primary.href} className={buttonVariants()}>{primary.label}</Link>
          {secondary ? <Link href={secondary.href} className={buttonVariants({ variant: "secondary" })}>{secondary.label}</Link> : null}
        </div>
      </div>
    </Card>
  );
}
