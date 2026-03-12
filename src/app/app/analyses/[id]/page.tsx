import { redirect } from "next/navigation";

export default async function AnalysisRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/analyses/${id}/overview`);
}
