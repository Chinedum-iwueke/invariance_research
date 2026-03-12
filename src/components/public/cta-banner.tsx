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
        <h2 className="text-3xl font-semibold leading-tight">{title}</h2>
        <p className="text-base text-text-neutral">{description}</p>
        <div className="flex justify-center gap-3">
          <Link href={primary.href} className={buttonVariants()}>{primary.label}</Link>
          {secondary ? <Link href={secondary.href} className={buttonVariants({ variant: "secondary" })}>{secondary.label}</Link> : null}
        </div>
      </div>
    </Card>
  );
}
