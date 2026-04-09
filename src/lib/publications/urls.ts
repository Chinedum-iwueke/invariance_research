import type { PublicationInput, PublicationRecord } from "@/lib/publications/model";

export function toPublicationViewerUrl(slug: string) {
  return `/research/${slug}/viewer`;
}

export function toCanonicalPublication(input: PublicationInput): PublicationRecord {
  return {
    ...input,
    source: input.source ?? "manual",
    viewer_url: input.viewer_url?.trim() || toPublicationViewerUrl(input.slug),
    updated_at: input.updated_at ?? new Date().toISOString(),
  };
}
