export interface HeaderNavGroup {
  label: string;
  items: Array<{ label: string; href: string }>;
}

export const headerNavGroups: HeaderNavGroup[] = [
  {
    label: "OUR APPROACH",
    items: [
      { label: "Strategy Validation", href: "/strategy-validation" },
      { label: "Research Standards", href: "/research-standards" },
      { label: "Methodology", href: "/methodology" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [{ label: "Research", href: "/research" }],
  },
  {
    label: "IR LABS",
    // Keep this group intentionally lightweight for future lab expansions.
    items: [{ label: "Robustness Lab", href: "/robustness-lab" }],
  },
  {
    label: "OUR FIRM",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];
