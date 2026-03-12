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

export const analysisWorkflowItems: AppNavItem[] = [
  { label: "Overview", href: "/app/analyses/alpha-trend-v2/overview", icon: Gauge },
  { label: "Trade Distribution", href: "/app/analyses/alpha-trend-v2/distribution", icon: BarChart3 },
  { label: "Monte Carlo Crash Test", href: "/app/analyses/alpha-trend-v2/monte-carlo", icon: TrendingDown },
  { label: "Parameter Stability", href: "/app/analyses/alpha-trend-v2/stability", icon: SlidersHorizontal, locked: true },
  { label: "Execution Sensitivity", href: "/app/analyses/alpha-trend-v2/execution", icon: Activity },
  { label: "Regime Analysis", href: "/app/analyses/alpha-trend-v2/regimes", icon: Radar, locked: true },
  { label: "Risk of Ruin", href: "/app/analyses/alpha-trend-v2/ruin", icon: ShieldAlert, locked: true },
  { label: "Validation Report", href: "/app/analyses/alpha-trend-v2/report", icon: FileText },
];

export const appSecondaryItems: AppNavItem[] = [
  { label: "New Analysis", href: "/app/new-analysis", icon: Sparkles },
  { label: "Analyses", href: "/app/analyses", icon: ListChecks },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Workspace Home", href: "/app", icon: Sigma },
];
