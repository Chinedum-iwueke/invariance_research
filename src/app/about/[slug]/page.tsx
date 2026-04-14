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
          <div className="container-shell grid min-h-[68vh] items-center gap-8 py-section-md md:grid-cols-[0.9fr_1.1fr] md:gap-12">
            <div className="relative mx-auto w-full max-w-[20rem] overflow-hidden rounded-lg md:mx-0 md:max-w-[28rem]">
              <div className="relative aspect-[4/5] w-full">
                <Image src={profile.heroImageSrc} alt={profile.heroImageAlt} fill className="object-cover object-center" priority />
              </div>
            </div>
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">{profile.roleLabel}</p>
              <h1 className="text-[clamp(2.3rem,5.2vw,4.4rem)] font-semibold leading-[1.04] text-white">{profile.name}</h1>
              <p className="text-lg leading-relaxed text-white">{profile.title}</p>
              <div className="space-y-3 text-sm text-white md:text-base">
                <Link href={`mailto:${profile.email}`} className="group flex items-center gap-3 text-white/95 transition hover:text-white">
                  <span aria-hidden>✉</span>
                  <span className="font-medium">Email</span>
                </Link>
                <Link href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-3 text-white/95 transition hover:text-white">
                  <span aria-hidden>in</span>
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
