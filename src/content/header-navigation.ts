export interface HeaderNavGroup {
  label: string;
  href?: string;
  items: Array<{ label: string; href: string }>;
}

export const headerNavGroups: HeaderNavGroup[] = [
  {
    label: "STRATEGY VALIDATION",
    href: "/strategy-validation",
    items: [],
  },
  {
    label: "IR LABS",
    // Keep this group intentionally lightweight for future lab expansions.
    items: [
      { label: "Strategy Robustness Lab", href: "/robustness-lab" },
      { label: "Invariance Research Desk", href: "/research-desk" },
    ],
  },
  {
    label: "RESEARCH",
    href: "/research",
    items: [],
  },
  {
    label: "OUR FIRM",
    items: [
      { label: "About Us", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Methodology", href: "/methodology" },
      { label: "Research Standards", href: "/research-standards" },
      { label: "Terms of Use", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];
