import type { Metadata } from "next";
import {
  ClaimAuditPanel,
  EvidenceOutcomeGrid,
  HeroScene,
  LabDiagnosticWorkbench,
  RobustnessLabIntro,
  SectionSceneWrapper,
  ShareArtifactSection,
  ValidationDocketRail,
} from "@/components/public/home-scenes";
import { SectionHeader } from "@/components/ui/section-header";
import { PublicShell } from "@/components/public/public-shell";
import { HomePageScenesShell } from "@/components/public/home-page-scenes-shell";

export const metadata: Metadata = {
  title: "Invariance Research | Independent Quantitative Strategy Validation",
  description:
    "Execution-aware analysis, robustness testing, and capital risk diagnostics for quantitative traders.",
};

const sceneIds = ["hero", "claim", "lab", "artifact"];

export default function HomePage() {
  return (
    <PublicShell>
      <HomePageScenesShell sceneIds={sceneIds}>
        <HeroScene style={{ transform: "translate3d(0, var(--hero-shift), 0)", opacity: "var(--hero-opacity)" }} />
        <ValidationDocketRail />

        <SectionSceneWrapper
          id="claim"
          tone="soft"
          transition="sheet-reveal"
          style={{ transform: "translate3d(0, var(--next-shift), 0)", opacity: "var(--next-opacity)" }}
          className="transform-gpu transition-[transform,opacity] duration-500 ease-out"
        >
          <div className="space-y-8">
            <SectionHeader
              eyebrow="Claim Intake"
              title="The first experience is not a pitch. It is a cross-examination."
              description="A strategy arrives with a claim. Invariance turns that claim into a structured evidence record: what survives execution friction, what only survives favorable assumptions, and what should not be deployed yet."
            />
            <ClaimAuditPanel />
            <EvidenceOutcomeGrid />
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="lab" tone="base">
          <div className="space-y-8">
            <SectionHeader
              eyebrow="Strategy Robustness Lab"
              title="The Lab is the first room in the research operating system."
              description="The existing Robustness Lab becomes the wedge: upload an artifact, inspect its evidence sufficiency, run the diagnostics that are actually justified, then produce a report worth sharing."
            />
            <RobustnessLabIntro />
            <LabDiagnosticWorkbench />
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="artifact" tone="panel" className="border-b border-border-subtle">
          <div className="space-y-8 lg:space-y-10">
            <SectionHeader
              eyebrow="Shareable Evidence"
              title="The report is not a download. It is the demand object."
              description="Approach A wins when serious users share a report, argue with it, or ask for the next experiment. The homepage should make that future visible from the first scroll."
            />
            <ShareArtifactSection />
          </div>
        </SectionSceneWrapper>
      </HomePageScenesShell>
    </PublicShell>
  );
}
