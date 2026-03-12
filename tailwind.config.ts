import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand-research-red)",
        text: {
          institutional: "var(--text-institutional)",
          graphite: "var(--text-graphite)",
          neutral: "var(--text-neutral)",
        },
        surface: {
          white: "var(--surface-white)",
          panel: "var(--surface-panel)",
        },
        border: {
          subtle: "var(--border-divider)",
        },
        chart: {
          primary: "var(--chart-primary)",
          positive: "var(--chart-positive)",
          negative: "var(--chart-negative)",
          benchmark: "var(--chart-benchmark)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        raised: "var(--shadow-raised)",
      },
      maxWidth: {
        container: "var(--container-max)",
        narrow: "var(--container-narrow)",
      },
      spacing: {
        "section-xs": "var(--section-xs)",
        "section-sm": "var(--section-sm)",
        "section-md": "var(--section-md)",
        "section-lg": "var(--section-lg)",
        "section-xl": "var(--section-xl)",
        "card-sm": "var(--card-padding-sm)",
        "card-md": "var(--card-padding-md)",
        "card-lg": "var(--card-padding-lg)",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "sans-serif"],
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        normal: "var(--motion-normal)",
        slow: "var(--motion-slow)",
      },
    },
  },
  plugins: [],
} satisfies Config;
