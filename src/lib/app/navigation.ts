import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  FileText,
  Gauge,
  ListChecks,
  Radar,
  Settings,
  ShieldAlert,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
} from "lucide-react";

export interface AppNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  locked?: boolean;
}

const baseSecondaryItems: AppNavItem[] = [
  { key: "workspace:new-analysis", label: "New Analysis", href: "/app/new-analysis", icon: Sparkles },
  { key: "workspace:analyses", label: "Analyses", href: "/app/analyses", icon: ListChecks },
  { key: "workspace:settings", label: "Settings", href: "/app/settings", icon: Settings },
  { key: "workspace:billing", label: "Billing", href: "/app/billing", icon: FileText },
  { key: "workspace:upgrade", label: "Upgrade", href: "/app/upgrade", icon: Sparkles },
  { key: "workspace:home", label: "Workspace Home", href: "/app", icon: Sigma },
];

const adminSecondaryItem: AppNavItem = { key: "workspace:admin", label: "Admin Ops", href: "/app/admin", icon: ShieldAlert };

export function getAnalysisWorkflowItems(activeAnalysisId?: string): AppNavItem[] {
  if (!activeAnalysisId) {
    return [];
  }

  const base = `/app/analyses/${activeAnalysisId}`;
  return [
    { key: `${activeAnalysisId}:overview`, label: "Overview", href: `${base}/overview`, icon: Gauge },
    { key: `${activeAnalysisId}:distribution`, label: "Trade Distribution", href: `${base}/distribution`, icon: BarChart3 },
    { key: `${activeAnalysisId}:monte-carlo`, label: "Monte Carlo Crash Test", href: `${base}/monte-carlo`, icon: TrendingDown },
    { key: `${activeAnalysisId}:stability`, label: "Parameter Stability", href: `${base}/stability`, icon: SlidersHorizontal },
    { key: `${activeAnalysisId}:execution`, label: "Execution Sensitivity", href: `${base}/execution`, icon: Activity },
    { key: `${activeAnalysisId}:regimes`, label: "Regime Analysis", href: `${base}/regimes`, icon: Radar },
    { key: `${activeAnalysisId}:ruin`, label: "Risk of Ruin", href: `${base}/ruin`, icon: ShieldAlert },
    { key: `${activeAnalysisId}:report`, label: "Validation Report", href: `${base}/report`, icon: FileText },
  ];
}

export function getAppSecondaryItems(isAdmin: boolean): AppNavItem[] {
  return isAdmin ? [...baseSecondaryItems, adminSecondaryItem] : baseSecondaryItems;
}
