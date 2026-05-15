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
          paper: "var(--surface-paper)",
          panel: "var(--surface-panel)",
          muted: "var(--surface-muted)",
          subtle: "var(--surface-subtle)",
        },
        border: {
          DEFAULT: "var(--border-divider)",
          subtle: "var(--border-divider)",
          strong: "var(--border-strong)",
        },
        evidence: {
          supported: "var(--evidence-supported)",
          "supported-wash": "var(--evidence-supported-wash)",
          limited: "var(--evidence-limited)",
          "limited-wash": "var(--evidence-limited-wash)",
          unsupported: "var(--evidence-unsupported)",
          "unsupported-wash": "var(--evidence-unsupported-wash)",
          contradicted: "var(--evidence-contradicted)",
          "contradicted-wash": "var(--evidence-contradicted-wash)",
          locked: "var(--evidence-locked)",
          "locked-wash": "var(--evidence-locked-wash)",
          processing: "var(--evidence-processing)",
          "processing-wash": "var(--evidence-processing-wash)",
        },
        chart: {
          primary: "var(--chart-primary)",
          positive: "var(--chart-positive)",
          negative: "var(--chart-negative)",
          benchmark: "var(--chart-benchmark)",
          warning: "var(--chart-warning)",
          regime1: "var(--chart-regime-1)",
          regime2: "var(--chart-regime-2)",
          regime3: "var(--chart-regime-3)",
          neutral: "var(--chart-neutral)",
          grid: "var(--chart-grid)",
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
        "app-content-aligned": "var(--app-content-max-aligned)",
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
        sans: ["var(--font-interface)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
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
