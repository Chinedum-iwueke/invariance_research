import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  tertiaryCta?: { label: string; href: string };
  credibilityLine?: string;
  rightSlot?: ReactNode;
}

export function PageHero({ eyebrow, title, description, primaryCta, secondaryCta, tertiaryCta, credibilityLine, rightSlot }: PageHeroProps) {
  return (
    <section className="container-shell grid gap-10 py-section-lg md:grid-cols-[1.2fr_1fr] md:items-center">
      <div className="space-y-5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="max-w-3xl text-[clamp(2rem,4.6vw,3.25rem)] font-semibold leading-[1.08]">{title}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-text-neutral">{description}</p>
        {(primaryCta || secondaryCta) && (
          <div className="flex flex-wrap gap-3">
            {primaryCta ? <Link href={primaryCta.href} className={buttonVariants()}>{primaryCta.label}</Link> : null}
            {secondaryCta ? <Link href={secondaryCta.href} className={buttonVariants({ variant: "secondary" })}>{secondaryCta.label}</Link> : null}
          </div>
        )}
        {tertiaryCta ? <Link href={tertiaryCta.href} className="text-sm font-medium text-text-graphite underline-offset-4 hover:underline">{tertiaryCta.label}</Link> : null}
        {credibilityLine ? <p className="text-sm text-text-neutral">{credibilityLine}</p> : null}
      </div>
      <div>{rightSlot}</div>
    </section>
  );
}
