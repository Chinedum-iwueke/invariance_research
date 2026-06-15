import type { Metadata } from "next";
import { LogoMonogram } from "@/components/ui/logo";
import { PreviewGateForm } from "@/components/public/preview-gate-form";

export const metadata: Metadata = {
  title: "Private Access",
  description: "Invariance Research is currently available to selected testing accounts.",
};

export default async function ComingSoonPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;

  return (
    <main className="public-hero-band min-h-screen px-5 py-6 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <div className="max-w-3xl">
          <LogoMonogram className="h-12 w-auto md:h-16" priority />
          <p className="font-provenance mt-8 text-xs uppercase tracking-[0.16em] text-brand">Private research access</p>
          <h1 className="font-display mt-4 max-w-3xl text-5xl font-medium leading-none text-text-institutional md:text-7xl">
            Invariance Research Desk is opening quietly.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-text-neutral md:text-lg">
            Invariance Research is currently available to invited testers while the research workspace is being hardened. Enter your access password or request a seat.
          </p>
        </div>
        <PreviewGateForm nextPath={params.next ?? "/app"} />
        <p className="max-w-2xl text-xs leading-5 text-text-muted">
          Access is limited so test accounts, analysis workers, exports, and benchmark data can be monitored closely before broader availability.
        </p>
      </section>
    </main>
  );
}
