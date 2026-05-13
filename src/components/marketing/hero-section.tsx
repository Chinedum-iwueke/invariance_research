import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  credibility?: string;
  visualSlot?: ReactNode;
}

export function HeroSection({ eyebrow, title, description, credibility, visualSlot }: HeroSectionProps) {
  return (
    <section className="container-shell grid gap-8 py-section-md md:gap-12 md:py-section-lg md:grid-cols-[1.2fr_1fr] md:items-center">
      <div className="space-y-5 md:space-y-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="max-w-2xl text-[clamp(2rem,9vw,2.65rem)] font-semibold leading-[1.08] md:text-[clamp(2.5rem,5vw,3.25rem)] md:leading-[1.1]">{title}</h1>
        <p className="max-w-xl text-base leading-relaxed text-text-neutral md:text-lg">{description}</p>
        <div className="mobile-cta-row">
          <Button>View Validation Framework</Button>
          <Button variant="secondary">Read Methodology</Button>
        </div>
        {credibility ? <p className="text-sm text-text-neutral">{credibility}</p> : null}
      </div>
      <div>{visualSlot}</div>
    </section>
  );
}
