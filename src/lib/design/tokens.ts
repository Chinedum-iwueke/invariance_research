export const colors = {
  brand: {
    researchRed: "#B00020",
  },
  text: {
    institutionalBlack: "#111111",
    deepGraphite: "#2C2C2C",
    neutralGray: "#6B6B6B",
  },
  surface: {
    white: "#FFFFFF",
    panelGray: "#F7F7F7",
  },
  border: {
    dividerGray: "#E5E5E5",
  },
  chart: {
    primary: "#B00020",
    positive: "#2E7D32",
    negative: "#C62828",
    benchmark: "#1A73E8",
  },
} as const;

export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
} as const;

export const shadows = {
  soft: "0 2px 6px rgba(17, 17, 17, 0.04)",
  raised: "0 8px 18px rgba(17, 17, 17, 0.08)",
} as const;

export const borders = {
  subtle: "1px solid #E5E5E5",
  strong: "1px solid #D8D8D8",
} as const;

export const motion = {
  fast: "120ms",
  normal: "220ms",
  slow: "320ms",
} as const;

export const layout = {
  maxWidth: "80rem",
  narrowWidth: "64rem",
  sectionPaddingX: "1.5rem",
} as const;
