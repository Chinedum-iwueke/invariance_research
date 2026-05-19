import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { CtaBanner } from "@/components/public/cta-banner";
import { PageHero } from "@/components/public/page-hero";
import { ScrollspyRail } from "@/components/public/home-scenes";
import { LabEvidenceConsole, LabHeroInstrument, PageTransitionBand } from "@/components/public/validation-page-scenes";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { UploadPanel } from "@/components/ui/upload-panel";

export const metadata: Metadata = {
  title: "Strategy Robustness Lab | Invariance Research",
  description: "Execution-aware diagnostics platform for testing strategy resilience under realistic market conditions.",
};

const DEMO_VIDEO_PATH = "/demo_video.mp4";

export default function RobustnessLabPage() {
  const sectionIds = ["hero", "demo", "intake", "console", "outputs", "next", "cta"];
  const hasDemoVideo = existsSync(join(process.cwd(), "public", "demo_video.mp4"));

  return (
    <PublicShell>
      <main className="relative">
        <ScrollspyRail sectionIds={sectionIds} />
        <section id="hero">
          <PageHero
            title="Strategy Robustness Lab"
            description="Upload a strategy artifact, see what evidence it can support, and turn the claim into a reportable diagnostic record."
            primaryCta={{ label: "Sign up for free", href: "/signup" }}
            secondaryCta={{ label: "View methodology", href: "/methodology" }}
            credibilityLine="Fast evidence intake, clear limitations, and a shareable report path."
            rightSlot={<LabHeroInstrument />}
          />
        </section>

        <section id="demo" className="evidence-section-band">
          <div className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Working Surface"
            title="See how evidence moves through the Lab."
            description="The walkthrough follows the product sequence: intake, eligibility, diagnostics, and report."
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
                  <p className="text-xs uppercase tracking-[0.14em] text-white/65">Interactive walkthrough coming soon</p>
                  <p className="mt-3 max-w-2xl text-sm text-white/80">
                    The Lab is available now. A guided product walkthrough will appear here once the next demo cut is ready.
                  </p>
                </div>
              )}
            </div>
          </Card>
          </div>
        </section>

        <section id="intake" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Artifact Intake"
            title="What goes in determines what can be honestly claimed."
            description="The upload moment is the first trust boundary. Artifact richness determines which diagnostics can produce a strong verdict."
          />
          <UploadPanel />
        </section>

        <section id="console" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Evidence Console"
            title="Track the investigation from the first click."
            description="See what has been accepted, what is locked, and what the current evidence can support."
          />
          <LabEvidenceConsole />
        </section>

        <section id="outputs" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Lab Outputs"
            title="The output is a decision trail, not a pile of charts."
            description="Each workspace answers a capital-facing question and moves the user toward a durable report artifact."
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

        <section id="next" className="container-shell py-section-sm">
          <PageTransitionBand
            title="From Lab output to methodology."
            body="The Lab gives users a concrete first experience. The methodology page explains the rules that keep that experience honest."
            href="/methodology"
            label="Read the methodology"
          />
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
