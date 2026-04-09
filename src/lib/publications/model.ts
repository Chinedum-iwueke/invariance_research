export const publicationCategories = ["research_standard", "case_study", "research_note"] as const;

export type PublicationCategory = (typeof publicationCategories)[number];

export const publicationStatuses = ["draft", "published", "archived"] as const;

export type PublicationStatus = (typeof publicationStatuses)[number];

export type PublicationRecord = {
  id: string;
  title: string;
  slug: string;
  category: PublicationCategory;
  summary: string;
  status: PublicationStatus;
  published_at: string | null;
  updated_at: string;
  cover_image_url: string;
  pdf_url: string;
  viewer_url: string;
  featured: boolean;
  author_label?: string;
  estimated_read_time?: string;
  tags?: string[];
  sort_order?: number;
  seo_title?: string;
  seo_description?: string;
  source: "manual" | "admin";
};

export type PublicationInput = Omit<PublicationRecord, "viewer_url" | "source" | "updated_at"> & {
  viewer_url?: string;
  source?: "manual" | "admin";
  updated_at?: string;
};
