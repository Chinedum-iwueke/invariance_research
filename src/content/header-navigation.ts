export interface HeaderNavGroup {
  label: string;
  href?: string;
  items: Array<{ label: string; href: string }>;
}

export const headerNavGroups: HeaderNavGroup[] = [
  {
    label: "RESEARCH DESK",
    href: "/",
    items: [],
  },
  {
    label: "RESEARCH",
    href: "/research",
    items: [],
  },
  {
    label: "METHODOLOGY",
    href: "/methodology",
    items: [],
  },
  {
    label: "PRICING",
    href: "/pricing",
    items: [],
  },
];
