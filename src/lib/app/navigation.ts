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
  label: string;
  href: string;
  icon: LucideIcon;
  locked?: boolean;
}

const baseSecondaryItems: AppNavItem[] = [
  { label: "New Analysis", href: "/app/new-analysis", icon: Sparkles },
  { label: "Analyses", href: "/app/analyses", icon: ListChecks },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Billing", href: "/app/billing", icon: FileText },
  { label: "Upgrade", href: "/app/upgrade", icon: Sparkles },
  { label: "Workspace Home", href: "/app", icon: Sigma },
];

const adminSecondaryItem: AppNavItem = { label: "Admin Ops", href: "/app/admin", icon: ShieldAlert };

export function getAnalysisWorkflowItems(activeAnalysisId?: string): AppNavItem[] {
  if (!activeAnalysisId) {
    return [
      { label: "Overview", href: "/app/analyses", icon: Gauge },
      { label: "Trade Distribution", href: "/app/analyses", icon: BarChart3 },
      { label: "Monte Carlo Crash Test", href: "/app/analyses", icon: TrendingDown },
      { label: "Parameter Stability", href: "/app/analyses", icon: SlidersHorizontal, locked: true },
      { label: "Execution Sensitivity", href: "/app/analyses", icon: Activity },
      { label: "Regime Analysis", href: "/app/analyses", icon: Radar, locked: true },
      { label: "Risk of Ruin", href: "/app/analyses", icon: ShieldAlert, locked: true },
      { label: "Validation Report", href: "/app/analyses", icon: FileText },
    ];
  }

  const base = `/app/analyses/${activeAnalysisId}`;
  return [
    { label: "Overview", href: `${base}/overview`, icon: Gauge },
    { label: "Trade Distribution", href: `${base}/distribution`, icon: BarChart3 },
    { label: "Monte Carlo Crash Test", href: `${base}/monte-carlo`, icon: TrendingDown },
    { label: "Parameter Stability", href: `${base}/stability`, icon: SlidersHorizontal, locked: true },
    { label: "Execution Sensitivity", href: `${base}/execution`, icon: Activity },
    { label: "Regime Analysis", href: `${base}/regimes`, icon: Radar, locked: true },
    { label: "Risk of Ruin", href: `${base}/ruin`, icon: ShieldAlert, locked: true },
    { label: "Validation Report", href: `${base}/report`, icon: FileText },
  ];
}

export function getAppSecondaryItems(isAdmin: boolean): AppNavItem[] {
  return isAdmin ? [...baseSecondaryItems, adminSecondaryItem] : baseSecondaryItems;
}
