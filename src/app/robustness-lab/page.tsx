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
  title: "Prop Challenge Truth Room | Invariance Research",
  description: "Trade-history validation for prop-firm feasibility, first breach analysis, execution drag, and survivability stress.",
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
            title="Prop Challenge Truth Room"
            description="Upload a trade CSV or exchange export, enter the challenge rules, and see whether the strategy reaches target before it breaches daily or total drawdown."
            primaryCta={{ label: "Sign up for free", href: "/signup" }}
            secondaryCta={{ label: "View methodology", href: "/methodology" }}
            credibilityLine="Trade-history intake, exact rule reconstruction, first-breach evidence, and a shareable report path."
            rightSlot={<LabHeroInstrument />}
          />
        </section>

        <section id="demo" className="evidence-section-band">
          <div className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Working Surface"
            title="See how a trade history becomes a challenge verdict."
            description="The walkthrough follows the launch sequence: trade intake, rule entry, first breach, survival stress, and report."
          />
          <Card className="overflow-hidden border-border-subtle bg-surface-panel p-2 md:p-3">
            <div className="rounded-sm border border-border-subtle bg-[#0f141c] p-4 md:p-6">
              {hasDemoVideo ? (
                <video
                  className="h-auto w-full rounded-sm border border-white/10"
                  controls
                  preload="metadata"
                  aria-label="Prop Challenge Truth Room walkthrough demo"
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
            title="Trade history first. Everything else is evidence enrichment."
            description="The launch product is optimized for closed trade logs and exchange/broker exports. Richer files can help, but the self-serve verdict is anchored in the trade path."
          />
          <UploadPanel />
        </section>

        <section id="console" className="container-shell space-y-6 py-section-sm">
          <SectionHeader
            eyebrow="Evidence Console"
            title="Track the challenge investigation from the first click."
            description="See whether prop rules are exact or fallback, which diagnostics are supported, and which claims require Research Desk review."
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
                "Prop Evaluation Workspace",
                "Identify the first breach rule, target progress, rolling pass/fail windows, and challenge readiness under the selected rule sheet.",
                "Decision value: determines whether the strategy is worth attempting on a funded-account evaluation.",
              ],
              [
                "Monte Carlo / Risk of Ruin",
                "Translate path uncertainty into survivability ranges under adverse sequencing and volatility stress.",
                "Decision value: sets capital-risk boundaries and stop/go thresholds.",
              ],
              [
                "What automation refuses to overclaim",
                "Parameter stability, regime attribution, broker microstructure, reconstruction, and portfolio exposure are routed to Research Desk when evidence is insufficient.",
                "Decision value: prevents a trade-history upload from pretending to prove what it cannot prove.",
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
            title="Know before you pay for the challenge"
            description="Start with the trade-history truth room, then request Research Desk only when the missing evidence affects a real deployment, sale, or evaluation decision."
            primary={{ label: "Sign up for free", href: "/signup" }}
            secondary={{ label: "Request Validation Audit", href: "/contact" }}
          />
        </section>
      </main>
    </PublicShell>
  );
}
