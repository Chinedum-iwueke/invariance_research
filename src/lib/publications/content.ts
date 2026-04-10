import type { PublicationRecord } from "@/lib/publications/model";

export type PublicationArticleSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type PublicationArticleContent = {
  sections: PublicationArticleSection[];
};

const publicationContentBySlug: Record<string, PublicationArticleContent> = {
  "invariance-research-standards-2026": {
    sections: [
      {
        id: "execution-realism",
        title: "01 — Execution Realism",
        paragraphs: [
          "All strategy claims should be evaluated under realistic execution assumptions, including spread, slippage, partial fills, and queue position dynamics. Simulations that rely on frictionless fills materially overstate achievable results.",
          "Validation reports should state the assumed execution model and identify where outcomes are sensitive to liquidity stress, widened spreads, or latency conditions.",
        ],
      },
      {
        id: "robustness-integrity",
        title: "02 — Robustness Integrity",
        paragraphs: [
          "Parameter stability should be demonstrated through rolling windows, perturbation analysis, and out-of-sample validation. Performance that collapses with small parameter shifts should be treated as fragile.",
          "Every publication should document both favorable and adverse windows to avoid selection bias and preserve institutional decision quality.",
        ],
      },
      {
        id: "regime-awareness",
        title: "03 — Regime Awareness",
        paragraphs: [
          "Research conclusions should include explicit regime context. Strategies can behave differently across volatility, trend, and liquidity states, and those differences must be made visible.",
          "A publication is incomplete if it presents aggregate returns without clarifying behavior during market stress and structural transitions.",
        ],
      },
      {
        id: "capital-discipline",
        title: "04 — Capital Discipline",
        paragraphs: [
          "Publications should quantify drawdown concentration, tail exposure, and risk-of-ruin implications before recommending deployment. Capital efficiency must be balanced against survivability under adverse sequences.",
          "Leverage assumptions, margin constraints, and expected recovery profiles should be stated clearly for investment committees and risk stakeholders.",
        ],
      },
      {
        id: "reporting-standards",
        title: "05 — Reporting Standards",
        paragraphs: [
          "Institutional research should separate observations, assumptions, and recommendations. Methods, data scope, and known limitations must be transparent.",
          "Published documents should provide enough detail for repeatability and auditability, with PDF artifacts treated as downloadable records rather than the primary reading surface.",
        ],
      },
    ],
  },
};

function fallbackContent(publication: PublicationRecord): PublicationArticleContent {
  return {
    sections: [
      {
        id: "overview",
        title: "Overview",
        paragraphs: [publication.summary],
      },
    ],
  };
}

export function resolvePublicationContent(publication: PublicationRecord) {
  return publicationContentBySlug[publication.slug] ?? fallbackContent(publication);
}
