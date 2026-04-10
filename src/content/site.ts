export const primaryNav = [
  { label: "Research Standards", href: "/research-standards" },
  { label: "Strategy Validation", href: "/strategy-validation" },
  { label: "Robustness Lab", href: "/robustness-lab" },
  { label: "Research Desk", href: "/research-desk" },
  { label: "Research", href: "/research" },
  { label: "Methodology", href: "/methodology" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "Robustness Lab", href: "/robustness-lab" },
  { label: "Research Desk", href: "/research-desk" },
      { label: "Pricing", href: "/pricing" },
      { label: "Request Audit", href: "/contact" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Research Standards", href: "/research-standards" },
      { label: "Case Studies", href: "/research" },
      { label: "Methodology", href: "/methodology" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "LinkedIn", href: "#" },
    ],
  },
] as const;

export const featuredResearch = [
  {
    title: "Why Most EMA Crossover Strategies Fail Robustness Tests",
    category: "Robustness",
    summary:
      "A structured review of execution drag, parameter instability, and regime concentration across trend-following templates.",
  },
  {
    title: "Execution Costs: The Silent Edge Killer",
    category: "Execution",
    summary:
      "How slippage and spread asymmetry alter expected edge under realistic order simulation assumptions.",
  },
  {
    title: "Detecting Curve-Fit Strategies with Parameter Stability Maps",
    category: "Validation",
    summary:
      "Parameter surface diagnostics to identify fragile local optima before capital allocation decisions.",
  },
] as const;
