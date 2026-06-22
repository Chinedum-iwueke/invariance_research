import type { ParsedArtifact } from "@/lib/server/ingestion/contracts";

export const SUPPORTED_MARKET = "crypto" as const;

const CRYPTO_MARKET_TERMS = new Set(["crypto", "cryptocurrency", "digital_asset", "digital_assets"]);
const CRYPTO_EXCHANGES = new Set(["binance", "bybit", "okx", "coinbase", "kraken", "bitget", "deribit"]);
const CRYPTO_QUOTES = ["USDT", "USDC", "BUSD", "BTC", "ETH"];
const CRYPTO_BASES = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX", "LINK", "DOT"]);

export type MarketScopeResult = {
  supported: boolean;
  reason: string;
};

export function evaluateCryptoArtifactScope(artifact: ParsedArtifact): MarketScopeResult {
  const declaredMarkets = new Set(
    [artifact.bundle_manifest?.market, ...artifact.trades.map((trade) => trade.market)]
      .map(normalize)
      .filter(Boolean),
  );

  if ([...declaredMarkets].some((market) => CRYPTO_MARKET_TERMS.has(market))) {
    return { supported: true, reason: "Crypto market declared in the artifact." };
  }

  if (declaredMarkets.size > 0) {
    return {
      supported: false,
      reason: `Unsupported market declaration: ${[...declaredMarkets].join(", ")}. Invariance Research Desk currently supports crypto only.`,
    };
  }

  const exchanges = new Set(
    [artifact.bundle_manifest?.exchange, ...artifact.trades.map((trade) => trade.exchange)]
      .map(normalize)
      .filter(Boolean),
  );
  if ([...exchanges].some((exchange) => CRYPTO_EXCHANGES.has(exchange))) {
    return { supported: true, reason: "A supported crypto exchange was detected." };
  }

  const symbols = [...new Set(artifact.trades.map((trade) => trade.symbol?.trim().toUpperCase()).filter(Boolean))];
  if (symbols.length > 0 && symbols.every(isRecognizableCryptoSymbol)) {
    return { supported: true, reason: "Crypto symbols were detected." };
  }

  return {
    supported: false,
    reason: "Market could not be verified as crypto. Add a `market` column with `crypto`, include exchange metadata, or use recognizable crypto pair symbols.",
  };
}

function isRecognizableCryptoSymbol(rawSymbol: string) {
  const symbol = rawSymbol.replace(/[\/_:\s-]/g, "").replace(/PERP$/i, "");
  if (CRYPTO_BASES.has(symbol)) return true;
  return CRYPTO_QUOTES.some((quote) => symbol.endsWith(quote) && symbol.length > quote.length);
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[ -]+/g, "_") ?? "";
}
