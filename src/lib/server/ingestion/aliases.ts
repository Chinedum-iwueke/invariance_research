import type { CanonicalTradeSide, TradeCsvAliasMap } from "./contracts";

export const baseTradeCsvAliasMap: TradeCsvAliasMap = {
  entry_time: ["entry_time", "entry time", "entry", "opened_at", "open_time"],
  exit_time: ["exit_time", "exit time", "exit", "closed_at", "close_time"],
  symbol: ["symbol", "ticker", "instrument", "asset"],
  side: ["side", "direction", "position_side", "trade_side"],
  entry_price: ["entry_price", "entry price", "open_price", "buy_price"],
  exit_price: ["exit_price", "exit price", "close_price", "sell_price"],
  quantity: ["quantity", "qty", "size", "position_size"],
  fees: ["fees", "fee", "commission", "cost"],
  pnl: ["pnl", "profit", "net_pnl", "realized_pnl"],
  pnl_pct: ["pnl_pct", "return_pct", "pnl_percent", "roi"],
  mae: ["mae", "max_adverse_excursion"],
  mfe: ["mfe", "max_favorable_excursion"],
  trade_id: ["trade_id", "id", "ticket", "order_id"],
  strategy_name: ["strategy_name", "strategy", "system"],
  timeframe: ["timeframe", "tf", "interval"],
  market: ["market", "asset_class"],
  exchange: ["exchange", "venue"],
};

export function createTradeCsvAliasMap(overrides?: Partial<TradeCsvAliasMap>): TradeCsvAliasMap {
  if (!overrides) return baseTradeCsvAliasMap;

  const map: TradeCsvAliasMap = { ...baseTradeCsvAliasMap };
  Object.entries(overrides).forEach(([field, aliases]) => {
    if (!aliases) return;
    map[field] = aliases;
  });
  return map;
}

export function resolveCanonicalField(
  header: string,
  aliasMap: TradeCsvAliasMap,
): string | undefined {
  const normalizedHeader = normalizeHeader(header);
  return Object.entries(aliasMap).find(([, aliases]) =>
    aliases.some((alias) => normalizeHeader(alias) === normalizedHeader),
  )?.[0];
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

const LONG_ALIASES = new Set(["buy", "long", "b", "bull"]);
const SHORT_ALIASES = new Set(["sell", "short", "s", "bear"]);

export function normalizeTradeSide(input: string): CanonicalTradeSide | undefined {
  const normalized = input.trim().toLowerCase();
  if (LONG_ALIASES.has(normalized)) return "long";
  if (SHORT_ALIASES.has(normalized)) return "short";
  return undefined;
}
