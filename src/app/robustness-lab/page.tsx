import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { UploadPanel } from "@/components/ui/upload-panel";

export const metadata: Metadata = {
  title: "Strategy Robustness Lab | Invariance Research",
  description: "Execution-aware diagnostics platform for testing strategy resilience under realistic market conditions.",
};

const DEMO_VIDEO_PATH = "/demo_video.mp4";

export default function RobustnessLabPage() {
  const sectionIds = ["hero", "demo", "intake", "produces", "outputs", "who-for", "cta"];
  const hasDemoVideo = existsSync(join(process.cwd(), "public", "demo_video.mp4"));

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            eyebrow="Product"
            title="Strategy Robustness Lab"
            description="A research instrument that tests whether strategies survive realistic execution and adverse market conditions."
            primaryCta={{ label: "Sign up for free", href: "/signup" }}
            
          />
        </section>

        <section id="demo" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            title="See the Lab in Use"
            description="A walkthrough of the lightweight diagnostic flow used before formal validation."
          />
          <Card className="overflow-hidden border-border-subtle bg-surface-panel p-2 md:p-3">
            <div className="rounded-sm border border-border-subtle bg-[#0f141c] p-4 md:p-6">
              {hasDemoVideo ? (
                <video
                  className="h-auto w-full rounded-sm border border-white/10"
                  controls
                  preload="metadata"
                  aria-label="Strategy Robustness Lab walkthrough demo"
                >
                  <source src={DEMO_VIDEO_PATH} type="video/mp4" />
                  Your browser does not support the demo video.
                </video>
              ) : (
                <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-sm border border-dashed border-white/20 bg-black/20 px-6 text-center md:min-h-[440px]">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/65">Demo asset placeholder</p>
                  <p className="mt-3 max-w-2xl text-sm text-white/80">
                    Add <span className="font-medium text-white">public/demo_video.mp4</span> to render the full walkthrough directly in this frame.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </section>

        <section id="intake" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            title="What goes in"
            description="Upload research artifacts as the first step in a structured validation workflow, not a generic file handoff."
          />
          <UploadPanel />
        </section>

        <section id="produces" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            title="What the Lab Produces"
            description="The free lab produces a lightweight diagnostic layer for initial strategy triage."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Structured diagnostics", "Expose performance composition, degradation patterns, and hidden fragility."],
              ["Stress-tested analytical views", "Translate path uncertainty into realistic drawdown and survivability context."],
              ["Robustness and stability signals", "Identify where outcomes depend on narrow regimes or parameter sensitivity."],
              ["Validation-report outputs", "Consolidate results into a coherent artifact for investment and risk decisions."],
            ].map(([title, body]) => (
              <Card key={title} className="space-y-2 p-card-md">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-text-neutral">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="outputs" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            title="Output previews"
            description="A product view of what each workspace answers before capital is committed."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [
                "Diagnostics Workspace",
                "Surface fragility, degradation, and core performance structure across the uploaded strategy profile.",
                "Decision value: determines whether baseline behavior is stable enough to proceed.",
              ],
              [
                "Monte Carlo / Risk of Ruin",
                "Translate path uncertainty into survivability ranges under adverse sequencing and volatility stress.",
                "Decision value: sets capital-risk boundaries and stop/go thresholds.",
              ],
              [
                "What full validation includes",
                "Advanced diagnostics such as parameter stability and regime analysis are delivered inside structured audits.",
                "Decision value: confirms whether edge quality remains durable under deeper institutional review.",
              ],
              [
                "Validation Report",
                "Consolidate diagnostics, interpretation, and readiness posture into a shareable validation artifact.",
                "Decision value: supports committee review with traceable analytical evidence.",
              ],
            ].map(([title, description, decisionValue]) => (
              <Card key={title} className="space-y-3 p-card-md">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-text-neutral">{description}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-text-neutral">{decisionValue}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="who-for" className="container-shell space-y-6 py-section-sm">
          <SectionHeader title="Who it is for" description="Designed for discretionary and systematic teams that require methodical pre-deployment validation." />
          <FeatureGrid columns={4} />
        </section>

        <section id="cta" className="container-shell py-section-md">
          <CtaBanner
            title="Move from diagnostics to a clear deployment decision"
            description="Start with free diagnostics, then request a structured audit for decision-grade validation depth."
            primary={{ label: "Sign up for free", href: "/signup" }}
            secondary={{ label: "Request Validation Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
