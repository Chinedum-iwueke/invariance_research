export interface TeamBioProfile {
  slug: string;
  roleLabel: string;
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  heroImageSrc: string;
  heroImageAlt: string;
  bioParagraphs: string[];
}

export const TEAM_BIOS: TeamBioProfile[] = [
  {
    slug: "chinedum-iwueke",
    roleLabel: "Founder",
    name: "Chinedum Iwueke",
    title: "Independent Quantitative Validation Specialist",
    email: "chinedum@invarianceresearch.xyz",
    linkedinUrl: "https://linkedin.com",
    heroImageSrc: "/founder_image.png",
    heroImageAlt: "Portrait of Chinedum Iwueke",
    bioParagraphs: [
      "Chinedum Iwueke is the founder of Invariance Research, an independent quantitative validation studio focused on execution-aware strategy evaluation and robustness diagnostics.",
      "His work centers on identifying where trading strategies fail under realistic conditions—particularly where backtests diverge from deployable outcomes due to execution friction, parameter instability, and regime sensitivity.",
      "He began his career with a background in architecture, earning a Bachelor’s degree before transitioning into applied computer science at the graduate level. This combination shaped a systems-oriented approach to quantitative research—treating strategies not as isolated signals, but as structures that must remain stable under stress.",
      "He has over eight years of trading experience, with the majority focused on quantitative methods. Prior to founding Invariance Research, he worked within a crypto investment environment as a quantitative strategy development and validation specialist, contributing to the design and evaluation of systematic trading strategies under institutional constraints.",
      "Invariance Research was founded on the belief that most strategies fail not because they lack edge, but because they are not tested rigorously enough before capital is deployed. His work aims to close that gap by enforcing structured validation standards that align simulated performance with real-world execution.",
    ],
  },
];

export const TEAM_BIO_BY_SLUG = new Map(TEAM_BIOS.map((profile) => [profile.slug, profile]));
