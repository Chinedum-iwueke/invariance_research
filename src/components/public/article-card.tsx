import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ArticleCardProps {
  title: string;
  category: string;
  summary: string;
  href?: string;
  coverImageUrl?: string;
  publishedDate?: string | null;
  readTime?: string;
  ctaLabel?: string;
}

function formatPublicationDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function ArticleCard({
  title,
  category,
  summary,
  href = "#",
  coverImageUrl,
  publishedDate,
  readTime,
  ctaLabel = "Read Publication",
}: ArticleCardProps) {
  const formattedDate = formatPublicationDate(publishedDate);

  return (
    <Card className="space-y-4 p-card-md">
      {coverImageUrl ? (
        <img src={coverImageUrl} alt={`${title} cover`} className="aspect-[16/9] w-full rounded-sm border object-cover" />
      ) : (
        <div className="aspect-[16/9] rounded-sm border bg-surface-panel" />
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">{category}</p>
      <h3 className="text-lg font-semibold leading-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-text-neutral">{summary}</p>
      {(formattedDate || readTime) ? (
        <p className="text-xs text-text-neutral">{[formattedDate ? `Published ${formattedDate}` : null, readTime].filter(Boolean).join(" · ")}</p>
      ) : null}
      <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-brand">
        {ctaLabel} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
