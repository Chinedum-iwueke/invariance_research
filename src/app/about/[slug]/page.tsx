import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { TEAM_BIO_BY_SLUG, TEAM_BIOS } from "@/content/team-bios";

interface TeamBioPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return TEAM_BIOS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: TeamBioPageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = TEAM_BIO_BY_SLUG.get(slug);

  if (!profile) {
    return {
      title: "Team Bio | Invariance Research",
    };
  }

  return {
    title: `${profile.name} | Invariance Research`,
    description: `${profile.name}, ${profile.title}.`,
  };
}

export default async function TeamBioPage({ params }: TeamBioPageProps) {
  const { slug } = await params;
  const profile = TEAM_BIO_BY_SLUG.get(slug);

  if (!profile) {
    notFound();
  }

  return (
    <PublicShell>
      <main>
        <section className="public-hero-band border-b border-border-subtle">
          <div className="container-shell grid min-h-[32vh] items-center gap-5 py-10 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-5 md:py-12 lg:gap-6">
            <div className="relative mx-auto w-full max-w-[9rem] overflow-hidden rounded-sm border border-border-strong bg-surface-paper p-1 shadow-soft md:mx-0 md:max-w-[11rem]">
              <div className="relative aspect-[4/5] w-full">
                <Image src={profile.heroImageSrc} alt={profile.heroImageAlt} fill className="object-cover object-center" priority />
              </div>
            </div>
            <div className="space-y-3 md:space-y-4">
              <p className="eyebrow text-brand">{profile.roleLabel}</p>
              <h1 className="font-display text-[clamp(2.55rem,10vw,4.8rem)] font-medium leading-none text-text-institutional">{profile.name}</h1>
              <p className="text-sm leading-relaxed text-text-neutral md:text-base">{profile.title}</p>
              <div className="space-y-2 text-xs text-text-graphite md:text-sm">
                <Link href={`mailto:${profile.email}`} className="group flex items-center gap-2 transition hover:text-brand md:gap-2.5">
                  <span aria-hidden className="text-[0.8em] md:text-[0.9em]">✉</span>
                  <span className="font-medium">Email</span>
                </Link>
                <Link href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-2 transition hover:text-brand md:gap-2.5">
                  <span aria-hidden className="text-[0.8em] font-semibold md:text-[0.9em]">in</span>
                  <span className="font-medium">LinkedIn</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-white py-section-lg">
          <article className="container-shell mx-auto max-w-narrow space-y-6 text-base leading-relaxed text-text-graphite md:text-lg">
            {profile.bioParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        </section>
      </main>
    </PublicShell>
  );
}
