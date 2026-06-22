export const primaryNav = [
  { label: "Research Desk", href: "/" },
  { label: "Research", href: "/research" },
  { label: "Methodology", href: "/methodology" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
] as const;

export const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "Start Research", href: "/" },
      { label: "Import & Audit", href: "/robustness-lab" },
      { label: "Pricing", href: "/pricing" },
      { label: "Request Expert Review", href: "/contact" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Research Standards", href: "/research-standards" },
      { label: "Published Research", href: "/research" },
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
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
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
