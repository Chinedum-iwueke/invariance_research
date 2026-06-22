import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { ResearchStartComposer } from "@/components/research-programs/research-start-composer";
import { getServerSession } from "@/lib/server/auth/session";
import { listResearchPrograms } from "@/lib/server/research-programs/service";

export const metadata: Metadata = {
  title: "Invariance Research Desk | Crypto Strategy Research",
  description: "Turn a crypto market intuition into a governed research program, backtest, verdict, and durable research memory.",
};

export default async function HomePage() {
  const session = await getServerSession();
  const authenticated = Boolean(session?.user?.account_id);
  const programs = session?.user?.account_id
    ? await listResearchPrograms(session.user.account_id).catch(() => [])
    : [];

  return (
    <PublicShell>
      <ResearchStartComposer authenticated={authenticated} recentPrograms={programs} />
    </PublicShell>
  );
}
