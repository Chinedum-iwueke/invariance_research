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
        <section className="bg-brand text-white">
          <div className="container-shell grid min-h-[32vh] items-center gap-5 py-10 md:grid-cols-[0.78fr_1.22fr] md:gap-8 md:py-12">
            <div className="relative mx-auto w-full max-w-[9rem] overflow-hidden rounded-lg md:mx-0 md:max-w-[11rem]">
              <div className="relative aspect-[4/5] w-full">
                <Image src={profile.heroImageSrc} alt={profile.heroImageAlt} fill className="object-cover object-center" priority />
              </div>
            </div>
            <div className="space-y-3 md:space-y-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white md:text-xs">{profile.roleLabel}</p>
              <h1 className="text-[clamp(1.45rem,3.6vw,2.65rem)] font-semibold leading-[1.08] text-white">{profile.name}</h1>
              <p className="text-sm leading-relaxed text-white md:text-base">{profile.title}</p>
              <div className="space-y-2 text-xs text-white md:text-sm">
                <Link href={`mailto:${profile.email}`} className="group flex items-center gap-2 text-white/95 transition hover:text-white md:gap-2.5">
                  <span aria-hidden className="text-[0.8em] md:text-[0.9em]">✉</span>
                  <span className="font-medium">Email</span>
                </Link>
                <Link href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-2 text-white/95 transition hover:text-white md:gap-2.5">
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
