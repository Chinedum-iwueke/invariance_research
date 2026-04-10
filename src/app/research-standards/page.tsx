import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { Card } from "@/components/ui/card";
import { PublicationArticle } from "@/components/public/publication-article";
import { resolvePublicationContent } from "@/lib/publications/content";
import { resolveActiveResearchStandard } from "@/lib/server/publications/repository";

export const metadata: Metadata = {
  title: "Research Standards | Invariance Research",
  description: "Institutional validation standards for execution-aware strategy evaluation and robustness diagnostics.",
};

export default function ResearchStandardsPage() {
  const activeStandard = resolveActiveResearchStandard();

  return (
    <PublicShell>
      <main>
        {activeStandard ? (
          <PublicationArticle publication={activeStandard} content={resolvePublicationContent(activeStandard)} showBackToLibrary={false} />
        ) : (
          <div className="container-shell py-section-md">
            <Card className="p-card-lg">
              <p className="text-sm text-text-neutral">No published research standard is active yet. Publish one through admin or the manual content source.</p>
            </Card>
          </div>
        )}
      </main>
    </PublicShell>
  );
}
