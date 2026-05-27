import type { Metadata } from "next";
import {
  ClaimAuditPanel,
  EvidenceDocketShowcase,
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
  title: "Invariance Research | Prop Challenge Truth Room",
  description:
    "Upload trade history and test whether a strategy can survive realistic prop-firm rules, execution friction, and capital-risk stress.",
};

const sceneIds = ["hero", "claim", "lab", "artifact"];

export default function HomePage() {
  return (
    <PublicShell>
      <HomePageScenesShell sceneIds={sceneIds}>
        <HeroScene style={{ transform: "translate3d(0, var(--hero-shift), 0)", opacity: "var(--hero-opacity)" }} />
        <ValidationDocketRail />
        <EvidenceDocketShowcase />

        <SectionSceneWrapper
          id="claim"
          tone="soft"
          transition="sheet-reveal"
          style={{ transform: "translate3d(0, var(--next-shift), 0)", opacity: "var(--next-opacity)" }}
          className="transform-gpu transition-[transform,opacity] duration-500 ease-out"
        >
          <div className="space-y-8">
            <SectionHeader
              eyebrow="Claim Discipline"
              title="Every result is treated like a claim that has to earn trust."
              description="Upload the artifact you already have, then state what you believe it proves. The Lab separates declared claims from claims merely implied by the evidence, showing what survives execution friction, what depends on favorable assumptions, and what should not be deployed yet."
            />
            <ClaimAuditPanel />
            <EvidenceOutcomeGrid />
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="lab" tone="base">
          <div className="space-y-8">
            <SectionHeader
              eyebrow="Prop Challenge Truth Room"
              title="Start with the trade history you already have."
              description="Upload a trade CSV or exchange export, declare the challenge rules, and see whether the path reaches target before daily or total drawdown breaks the account."
            />
            <RobustnessLabIntro />
            <LabDiagnosticWorkbench />
          </div>
        </SectionSceneWrapper>

        <SectionSceneWrapper id="artifact" tone="panel" className="border-b border-border-subtle">
          <div className="space-y-8 lg:space-y-10">
            <SectionHeader
              eyebrow="Shareable Evidence"
              title="A validation report built to travel."
              description="Export a defensible memo that states the verdict, the evidence behind it, and the limitations a buyer, investor, partner, or internal reviewer should understand."
            />
            <ShareArtifactSection />
          </div>
        </SectionSceneWrapper>
      </HomePageScenesShell>
    </PublicShell>
  );
}
