import type { PublicationRecord } from "@/lib/publications/model";

export type PublicationFigureBlock = {
  type: "figure";
  label?: string;
  title: string;
  media: string;
  note?: string;
};

export type PublicationCalloutBlock = {
  type: "callout";
  text: string;
};

export type PublicationArticleParagraphBlock = {
  type: "paragraph";
  text: string;
};

export type PublicationArticleBlock = PublicationArticleParagraphBlock | PublicationFigureBlock | PublicationCalloutBlock;

export type PublicationArticleSection = {
  id: string;
  title: string;
  level?: 2 | 3;
  blocks: PublicationArticleBlock[];
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
        blocks: [
          {
            type: "paragraph",
            text: "All strategy claims should be evaluated under realistic execution assumptions, including spread, slippage, partial fills, and queue position dynamics. Simulations that rely on frictionless fills materially overstate achievable results.",
          },
          {
            type: "callout",
            text: "No strategy may be described as production-ready unless its edge remains present under conservative execution-cost assumptions.",
          },
          {
            type: "paragraph",
            text: "Validation reports should state the assumed execution model and identify where outcomes are sensitive to liquidity stress, widened spreads, or latency conditions.",
          },
        ],
      },
      {
        id: "robustness-integrity",
        title: "02 — Robustness Integrity",
        blocks: [
          {
            type: "paragraph",
            text: "Parameter stability should be demonstrated through rolling windows, perturbation analysis, and out-of-sample validation. Performance that collapses with small parameter shifts should be treated as fragile.",
          },
          {
            type: "figure",
            label: "Figure 1",
            title: "Robustness profile across calibration windows",
            media: "Illustrative robustness profile: performance remains within bounded variance across rolling train/test windows rather than relying on one concentrated favorable period.",
            note: "Interpretation: window-level consistency is weighted more heavily than peak period return.",
          },
          {
            type: "paragraph",
            text: "Every publication should document both favorable and adverse windows to avoid selection bias and preserve institutional decision quality.",
          },
        ],
      },
      {
        id: "regime-awareness",
        title: "03 — Regime Awareness",
        blocks: [
          {
            type: "paragraph",
            text: "Research conclusions should include explicit regime context. Strategies can behave differently across volatility, trend, and liquidity states, and those differences must be made visible.",
          },
          {
            type: "paragraph",
            text: "A publication is incomplete if it presents aggregate returns without clarifying behavior during market stress and structural transitions.",
          },
        ],
      },
      {
        id: "capital-discipline",
        title: "04 — Capital Discipline",
        blocks: [
          {
            type: "paragraph",
            text: "Publications should quantify drawdown concentration, tail exposure, and risk-of-ruin implications before recommending deployment. Capital efficiency must be balanced against survivability under adverse sequences.",
          },
          {
            type: "callout",
            text: "Capital allocation guidance must express both expected return and expected survivability under stress, not only one.",
          },
          {
            type: "paragraph",
            text: "Leverage assumptions, margin constraints, and expected recovery profiles should be stated clearly for investment committees and risk stakeholders.",
          },
        ],
      },
      {
        id: "reporting-standards",
        title: "05 — Reporting Standards",
        blocks: [
          {
            type: "paragraph",
            text: "Institutional research should separate observations, assumptions, and recommendations. Methods, data scope, and known limitations must be transparent.",
          },
          {
            type: "paragraph",
            text: "Published documents should provide enough detail for repeatability and auditability, with PDF artifacts treated as downloadable records rather than the primary reading surface.",
          },
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
        blocks: [{ type: "paragraph", text: publication.summary }],
      },
    ],
  };
}

export function resolvePublicationContent(publication: PublicationRecord) {
  return publicationContentBySlug[publication.slug] ?? fallbackContent(publication);
}
