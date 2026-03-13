import type { ArtifactRichness } from "./contracts";

export type ArtifactContextPresence = {
  metadataPresent: boolean;
  assumptionsPresent: boolean;
  equityCurvePresent: boolean;
  ohlcvPresent: boolean;
  paramsPresent: boolean;
};

export function classifyArtifactRichness(context: ArtifactContextPresence): ArtifactRichness {
  if (!context.metadataPresent) {
    return "trade_only";
  }

  if (context.ohlcvPresent || context.paramsPresent) {
    return "research_complete";
  }

  if (context.assumptionsPresent || context.equityCurvePresent) {
    return "trade_plus_context";
  }

  return "trade_plus_metadata";
}
