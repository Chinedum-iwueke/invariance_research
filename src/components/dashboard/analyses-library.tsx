"use client";

import { useEffect, useState } from "react";
import type { AnalysisListItem, AnalysisListResponse } from "@/lib/contracts";
import { AnalysisTable } from "@/components/dashboard/analysis-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SkeletonState } from "@/components/dashboard/skeleton-state";

export function AnalysesLibrary() {
  const [items, setItems] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/analyses", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AnalysisListResponse;
        setItems(payload.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonState rows={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No analyses yet"
        body="Submit a new research artifact to create your first analysis record."
        cta={{ label: "Create New Analysis", href: "/app/new-analysis" }}
      />
    );
  }

  return <AnalysisTable analyses={items} />;
}
