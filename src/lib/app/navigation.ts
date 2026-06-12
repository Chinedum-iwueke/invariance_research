import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpCircle,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  GitBranch,
  Inbox,
  ListChecks ,
  Network,
  Settings,
  ShieldAlert,
  Sigma,
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
  { key: "workspace:home", label: "Workspace Home", href: "/app", icon: Sigma },
  { key: "workspace:programs", label: "Research Programs", href: "/app/programs", icon: GitBranch },
  { key: "workspace:queue", label: "Experiment Queue", href: "/app/queue", icon: Network },
  { key: "workspace:memory", label: "Memory", href: "/app/memory", icon: BrainCircuit },
  { key: "workspace:reports", label: "Program Reports", href: "/app/reports", icon: FileText },
  { key: "workspace:new-analysis", label: "Audit Import", href: "/app/new-analysis", icon: Inbox },
  { key: "workspace:analyses", label: "Audit Analyses", href: "/app/analyses", icon: ListChecks },
  { key: "workspace:billing", label: "Billing & Plan", href: "/app/billing", icon: CreditCard },
  { key: "workspace:upgrade", label: "Upgrade", href: "/app/upgrade", icon: ArrowUpCircle },
  { key: "workspace:settings", label: "Settings", href: "/app/settings", icon: Settings },
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
    { key: `${activeAnalysisId}:execution`, label: "Execution Sensitivity", href: `${base}/execution`, icon: Activity },
    { key: `${activeAnalysisId}:ruin`, label: "Risk of Ruin", href: `${base}/ruin`, icon: ShieldAlert },
    { key: `${activeAnalysisId}:prop-evaluation`, label: "Prop Evaluation", href: `${base}/prop-evaluation`, icon: ClipboardCheck },
    { key: `${activeAnalysisId}:assumptions`, label: "Assumption Ledger", href: `${base}/assumptions`, icon: ClipboardCheck },
    { key: `${activeAnalysisId}:report`, label: "Validation Report", href: `${base}/report`, icon: FileText },
  ];
}

export function getAppSecondaryItems(isAdmin: boolean): AppNavItem[] {
  return isAdmin ? [...baseSecondaryItems, adminSecondaryItem] : baseSecondaryItems;
}
