import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { EvidenceArtifactPreview } from "@/components/public/evidence-artifact-preview";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  tertiaryCta?: { label: string; href: string };
  credibilityLine?: string;
  rightSlot?: ReactNode;
  artifactVariant?: "lab" | "report" | "desk" | "legal";
}

export function PageHero({ eyebrow, title, description, primaryCta, secondaryCta, tertiaryCta, credibilityLine, rightSlot, artifactVariant = "report" }: PageHeroProps) {
  return (
    <section className="public-hero-band border-b border-border-subtle">
      <div className="container-shell grid gap-8 py-section-md md:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] md:items-center md:gap-12 md:py-section-lg">
      <div className="space-y-4 md:space-y-5">
        <p className="eyebrow text-brand">{eyebrow ?? "Evidence-led strategy validation"}</p>
        <h1 className="font-display max-w-3xl text-[clamp(2.55rem,12vw,4.2rem)] font-medium leading-[0.96] text-text-institutional md:text-[clamp(4rem,6.4vw,5.6rem)]">{title}</h1>
        <p className="max-w-2xl text-[1rem] leading-[1.78] text-text-neutral md:text-lg md:leading-relaxed">{description}</p>
        {(primaryCta || secondaryCta) && (
          <div className="mobile-cta-row">
            {primaryCta ? <Link href={primaryCta.href} className={buttonVariants()}>{primaryCta.label}</Link> : null}
            {secondaryCta ? <Link href={secondaryCta.href} className={buttonVariants({ variant: "secondary" })}>{secondaryCta.label}</Link> : null}
          </div>
        )}
        {tertiaryCta ? <Link href={tertiaryCta.href} className="text-sm font-medium text-text-graphite underline-offset-4 hover:underline">{tertiaryCta.label}</Link> : null}
        {credibilityLine ? <p className="font-provenance text-xs uppercase tracking-[0.08em] text-text-neutral">{credibilityLine}</p> : null}
      </div>
      <div>{rightSlot ?? <EvidenceArtifactPreview variant={artifactVariant} />}</div>
      </div>
    </section>
  );
}
